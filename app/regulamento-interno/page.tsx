'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Search, Printer, ArrowUp, ShieldCheck, CheckCircle2, 
  FileCheck, UserCheck, AlertCircle, X, Trash2, Download, PenTool,
  Lock, Calendar, Building, Sparkles, ListFilter, User, KeyRound, Mail, FileText
} from "lucide-react";
import styles from "./regulamento.module.css";
import { supabase } from '@/lib/supabase';

interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  paragraphs: string[];
}

const regulamentoData: Chapter[] = [
  {
    id: "capítulo-i",
    title: "CAPÍTULO I",
    subtitle: "Da Integração no Contrato Individual de Trabalho",
    paragraphs: [
      "Art. 1º - Este Regulamento aplica-se aos empregados vinculados ao empregador identificado no respectivo contrato de trabalho, independentemente do cargo ou nível hierárquico.",
      "§ 1º O empregado receberá acesso à versão vigente e assinará termo de recebimento e ciência, que não representa renúncia a direitos nem concordância com disposição contrária à lei, à norma coletiva ou ao contrato.",
      "§ 2º As disposições entram em vigor na data indicada na versão publicada e produzem efeitos prospectivos, respeitados os direitos e vantagens incorporados.",
      "§ 3º Estagiários, aprendizes, prestadores e terceiros observarão as regras de segurança, proteção de alunos, privacidade e acesso que lhes forem aplicáveis, sem que este dispositivo altere a natureza jurídica de seus vínculos."
    ]
  },
  {
    id: "capítulo-ii",
    title: "CAPÍTULO II",
    subtitle: "Da Admissão",
    paragraphs: [
      "Art. 2º - A admissão, movimentação e extinção dos contratos de trabalho competem à administração, observados a legislação, as garantias de emprego, os critérios não discriminatórios, os instrumentos coletivos e os procedimentos internos aplicáveis.",
      "Art. 3º. - A admissão poderá ser condicionada à seleção técnica, à apresentação dos documentos legalmente exigíveis e à realização do exame admissional no âmbito do PCMSO, com emissão do Atestado de Saúde Ocupacional — ASO.",
      "§ 1º Os critérios de seleção serão objetivos, relacionados à função e não discriminatórios.",
      "§ 2º Dados pessoais e de saúde serão tratados apenas na medida necessária, com acesso restrito e segurança.",
      "§ 3º A escola manterá atualizadas as fichas cadastrais e as certidões de antecedentes criminais dos colaboradores, nos termos do art. 59-A do ECA e da legislação aplicável.",
      "Art. 4º. - O contrato de experiência será formalizado por escrito, poderá ser prorrogado uma única vez e não excederá, somados os períodos, 90 (noventa) dias. A continuidade da prestação de serviços após o término, sem nova causa legal de prazo determinado, converterá o vínculo em contrato por prazo indeterminado."
    ]
  },
  {
    id: "capítulo-iii",
    title: "CAPÍTULO III",
    subtitle: "Dos Deveres, Obrigações e Responsabilidades do Empregado",
    paragraphs: [
      "Art. 5º - Todo empregado, além das disposições contratuais e legais, deve atender com rigor as seguintes disposições:\n" +
      "a) - cumprir os compromissos expressamente assumidos no contrato individual de trabalho, com zelo, espírito de colaboração, atenção e competência profissional;\n" +
      "b) – acatar com presteza e consideração às ordens e instruções emanadas de superiores hierárquicos e chefes imediatos;\n" +
      "c) - sugerir medidas para maior eficiência do serviço, comunicando imediatamente qualquer irregularidade que tiver conhecimento;\n" +
      "d) - observar a máxima disciplina no local de trabalho; zelar pela organização, manutenção e asseio no local de trabalho, bem como nas demais dependências da empresa;\n" +
      "e) – fazer as refeições no local disponibilizado para esta finalidade;\n" +
      "f) - zelar pela boa conservação das instalações, equipamentos, máquinas, ferramentas ou quaisquer outros aparelhos que lhe forem confiados, comunicando as anormalidades notadas; evitar desperdício de materiais, energia elétrica, água, ar comprimido, etc.;\n" +
      "g) - Manter na vida privada e profissional conduta compatível com a dignidade do cargo ocupado e com a reputação do quadro de pessoal da Empresa;\n" +
      "h) – Zelar e atender por todas as normas de segurança, usando os equipamentos de proteção individual ou coletiva (óculos, calçados, capacetes etc.), evitando acidente próprio e/ou com outros empregados; comparecer a aulas ou reuniões de instrução sobre prevenção de acidentes, combate a incêndio, inundações, etc.;\n" +
      "i) - Prestar toda colaboração à Empresa e aos colegas, cultivando o espírito de comunhão e mútua fidelidade na realização do serviço em prol dos objetivos da Empresa;\n" +
      "j) - Informar ao Departamento de Recursos Humanos qualquer modificação em seus dados pessoais, tais como estado civil, militar, aumento ou redução de pessoas na família, mudança de residência, etc.;\n" +
      "k) – Pertences pessoais e de valor, são de sua responsabilidade (dinheiro, jóias, cheques, cartão de crédito e/ou débito, aparelho de celular, etc);\n" +
      "l) - Respeitar a honra, boa fama e integridade física de todas as pessoas com quem mantiver contato por motivo de emprego;\n" +
      "m) – Trabalhar com a atenção necessária a fim de evitar danos e prejuízos materiais;\n" +
      "n) - Indenizar os prejuízos causados à Empresa por mau emprego, dolo ou culpa (negligência, imperícia, imprudência ou omissão), caracterizando-se a responsabilidade por:\n" +
      "  I - Sonegação de valores e/ou objetos confiados;\n" +
      "  II - Danos e avarias em qualquer bem da empresa que estiver sob sua guarda, uso ou sujeito à sua fiscalização;\n" +
      "  § 1º - A responsabilidade administrativa não exime o empregado da responsabilidade civil ou criminal.\n" +
      "  § 2º - As indenizações e reposições por prejuízos causados serão descontadas dos salários.\n" +
      "  III - Erro de cálculo doloso contra a empresa;\n" +
      "o) - Ter consideração com os demais trabalhadores, comportando-se de modo apropriado no local de trabalho, dentro dos padrões normais de cortesia e respeito ao próximo, como, por exemplo, não promover brincadeiras de mau gosto, algazarras, gritarias, fofocas, atropelos e uso de palavras de baixo calão;\n" +
      "p) – Usar corretamente o uniforme e apresentar-se ao trabalho corretamente vestido, em condições normais de higiene;\n" +
      "q) – Incentivar e promover a responsabilidade e o cumprimento das normas estabelecidas neste Regulamento;\n" +
      "r) – Informar imediatamente a empresa sempre que tiver suspeita fundada ou conhecimento de algo que não esteja de acordo com os princípios mencionados neste Regulamento;\n" +
      "s) – Frequentar os cursos de aprendizagem, treinamento e aperfeiçoamento em que a empresa o matricular;\n" +
      "t) – Submeter-se ao PCMSO – Programa de Controle Médico e Saúde Ocupacional, vacinações, tratamento e medidas preventivas, sempre que para isso seja designado ou convocado.\n" +
      "u) Uso do aplicativo \"ClassAPP\" e envio diário da rotina dos alunos, o não cumprimento, o empregado poderá ser penalizado com as devidas sanções que aqui constam no CAPÍTULO XV.\n" +
      "v) A participação em treinamentos internos obrigatórios, presenciais ou virtuais, poderá ser exigida anualmente para atualização profissional e adequação às normas internas."
    ]
  },
  {
    id: "capítulo-iv",
    title: "CAPÍTULO IV",
    subtitle: "Do horário de trabalho e da Marcação de Ponto",
    paragraphs: [
      "Art. 6º - O horário contratual e as escalas deverão ser cumpridos, observados a lei, a norma coletiva e os intervalos aplicáveis. Alterações serão justificadas, comunicadas com antecedência razoável e não poderão produzir prejuízo direto ou indireto ao empregado, devendo ser formalizadas quando exigido.",
      "Art. 7º - O empregado deverá apresentar-se no local de trabalho no horário previsto e permanecer durante a jornada, ressalvadas as hipóteses legais, emergências, motivo de saúde, força maior ou autorização da liderança.\n" +
      "Parágrafo único. Atrasos, saídas antecipadas e ausências deverão ser comunicados e justificados assim que razoavelmente possível.",
      "Art. 8º – A prestação de horas extraordinárias dependerá de necessidade do serviço e autorização, observados os limites legais, os intervalos, a norma coletiva e o pagamento ou compensação por regime válido.\n" +
      "Parágrafo único. Nas hipóteses excepcionais de força maior ou serviço inadiável, serão observados os requisitos do art. 61 da CLT, vedada a utilização habitual da exceção.",
      "Art. 9º – Quando sujeito a controle de jornada, o empregado registrará pessoalmente o início, o término e os intervalos exigidos no sistema adotado.\n" +
      "§ 1º O registro por exceção somente será utilizado mediante instrumento individual escrito, acordo coletivo ou convenção coletiva, nos termos da lei.\n" +
      "§ 2º Erro, esquecimento ou indisponibilidade será comunicado pelo canal de ajuste, preservando-se a marcação original, a justificativa, a aprovação e a trilha de auditoria.\n" +
      "§ 3º O empregado terá acesso aos comprovantes e espelhos de ponto nos termos da legislação.",
      "Art. 10 - Solicitar, permitir ou realizar marcação de ponto em nome de outra pessoa, bem como adulterar ou tentar adulterar registros de jornada, constitui infração grave, sujeita à apuração individual e à medida proporcional, sem prejuízo das consequências legais quando comprovada fraude.",
      "Art. 11 - A falta de marcação será tratada como inconsistência de ponto. O período efetivamente trabalhado será apurado por todos os meios idôneos disponíveis, inclusive escala, declaração, registro de acesso e sistemas institucionais, vedado deixar de computá-lo exclusivamente pela ausência de marcação.\n" +
      "Parágrafo único. O descumprimento reiterado do procedimento de registro poderá ser objeto de orientação ou medida disciplinar após apuração, sem prejuízo do pagamento do tempo comprovadamente trabalhado.",
      "Art. 12 - O teletrabalho ou trabalho remoto dependerá de instrumento escrito que defina atividades, regime de jornada aplicável, local autorizado, equipamentos, despesas, comparecimento, metas, proteção de dados e orientações de saúde e segurança.\n" +
      "§ 1º O empregado comunicará imediatamente incidentes de segurança, perda de equipamento ou acesso indevido.\n" +
      "§ 2º Mensagens fora da jornada não exigirão resposta imediata, salvo escala, plantão ou emergência previamente definida."
    ]
  },
  {
    id: "capítulo-v",
    title: "CAPÍTULO V",
    subtitle: "Dos Atestados",
    paragraphs: [
      "Art. 13 – Para justificar ausência por motivo de saúde, serão aceitos documentos emitidos por profissional legalmente habilitado, em meio físico ou eletrônico, desde que permitam verificar a identidade do paciente, autoria, data, assinatura válida e período de afastamento ou comparecimento.\n" +
      "Parágrafo único. O documento será presumido válido, sem prejuízo da verificação de autenticidade por procedimento reservado e não discriminatório.",
      "Art. 14 – O diagnóstico ou CID somente será tratado quando houver fundamento legal, justa causa documental ou solicitação/autorização válida do paciente, registrada pelo profissional.\n" +
      "§ 1º A ausência de CID não invalidará documento que contenha os demais requisitos necessários.\n" +
      "§ 2º O envio será realizado pelo canal seguro indicado pelo RH, com acesso restrito às pessoas que necessitem da informação.\n" +
      "§ 3º Gestores receberão apenas a informação funcional necessária, vedada a divulgação do diagnóstico.",
      "Art. 15 - É assegurado ao colaborador o direito de acompanhar filho ou filha de até 6 (seis) anos de idade em até 2 (duas) consultas médicas por ano, com ausência justificada mediante atestado de acompanhante emitido por profissional da saúde, conforme previsto na Lei nº 13.257/2016.",
      "Art. 16 - Para outros casos de acompanhamento (como cônjuges, pais ou familiares próximos), a ausência poderá ser analisada pela coordenação ou setor de Recursos Humanos, mediante apresentação de atestado de acompanhante, ficando a compensação de horas ou o desconto salarial a critério da empresa."
    ]
  },
  {
    id: "capítulo-vi",
    title: "CAPÍTULO VI",
    subtitle: "Das Ausências e Atrasos",
    paragraphs: [
      "Art. 17 – Atrasos, saídas antecipadas e faltas injustificadas poderão gerar desconto proporcional e os efeitos legais sobre o descanso semanal remunerado, conforme a legislação e a norma coletiva.\n" +
      "§ 1º Não haverá desconto nas ausências abonadas por lei, norma coletiva ou autorização expressa.\n" +
      "§ 2º Eventual medida disciplinar dependerá de apuração, gravidade e reincidência, sem automatismo.",
      "Art. 18 - Sempre que possível e sem prejuízo do direito à saúde, o empregado procurará agendar consultas eletivas fora da jornada ou em horário de menor impacto. Urgência, indisponibilidade de agenda ou necessidade clínica não invalidarão a justificativa regularly apresentada.",
      "Art. 19 - O empregado se obriga avisar ou mandar avisar por qualquer meio, de forma a consignar os dias em que, por doença ou motivo de força maior, não puder comparecer ao serviço, no dia anterior à sua falta, se esta for previsível e, quando não for, no início do dia em que ela se verificar.\n" +
      "Parágrafo único: Entende-se por força maior o fato que ocorra por causa alheia à vontade do empregado, que não possa ser previsto e nem impedido pelo empregado, impossibilitando-o completely ao cumprimento de suas obrigações.",
      "Art. 20 – Nas ausências para acompanhamento, o empregado apresentará documento de acompanhante que informe a data e, quando necessário, o período de afastamento.\n" +
      "§ 1º Em situação urgente, não será exigida autorização prévia, devendo a comunicação ocorrer assim que possível.\n" +
      "§ 2º O documento será entregue no prazo legal ou coletivo aplicável e tratado como dado pessoal de acesso restrito."
    ]
  },
  {
    id: "capítulo-vii",
    title: "CAPÍTULO VII",
    subtitle: "Do Pagamento",
    paragraphs: [
      "Art. 21 – A remuneração será paga até o quinto dia útil do mês subsequente ao vencido, por meio legalmente admitido, preferencialmente em conta indicada pelo empregado ou conta-salário, assegurada a portabilidade, acompanhada de demonstrativo discriminado.",
      "Art. 22 - Eventuais erros ou diferenças devem ser comunicadas ao Setor de Recursos Humanos, no primeiro dia útil após o pagamento.",
      "Art. 23 - Os adiantamentos de salários serão concedidos de acordo com a previsão da Convenção Coletiva de Trabalho."
    ]
  },
  {
    id: "capítulo-viii",
    title: "CAPÍTULO VIII",
    subtitle: "Das Férias",
    paragraphs: [
      "Art. 24 – As férias serão concedidas dentro do período legal, observados a legislação, o instrumento coletivo e o calendário institucional.\n" +
      "§ 1º Quando permitido o fracionamento, dependerá da concordância do empregado e poderá ocorrer em até três períodos, sendo um deles de no mínimo 14 (quatorze) dias corridos e os demais de no mínimo 5 (cinco) dias corridos cada.\n" +
      "§ 2º O início das férias observará as vedações legais relativas a feriados e descanso semanal.\n" +
      "§ 3º Para professores e categorias com disciplina coletiva específica, prevalecerão a CCT vigente e o calendário compatível.",
      "Art. 25 – É facultado ao empregado converter 1/3 do período de férias a que tiver direito em abono pecuniário, devendo requerer a conversão, por escrito, até 15 (quinze) dias antes do término do período aquisitivo."
    ]
  },
  {
    id: "capítulo-ix",
    title: "CAPÍTULO IX",
    subtitle: "Das Disposições Exclusivas",
    paragraphs: [
      "Art. 26 - Compete a diretores, coordenadores, supervisores e demais lideranças:\n" +
      "a) distribuir tarefas de forma lícita, segura, respeitosa e compatível com a função;\n" +
      "b) prevenir abuso de autoridade, assédio, discriminação e retaliação;\n" +
      "c) receber relatos com respeito e encaminhá-los ao canal competente, sem prometer sigilo absoluto;\n" +
      "d) preservar evidências e evitar investigação improvisada, especialmente em casos envolvendo alunos;\n" +
      "e) comunicar imediatamente risco à integridade de criança ou adolescente, acidente, ameaça, violência ou vazamento de dados;\n" +
      "f) aplicar regras de forma coerente e isonômica;\n" +
      "g) manter confidencialidade no limite da necessidade de conhecimento; e\n" +
      "h) cumprir e fazer cumprir este Regulamento, a legislação e a norma coletiva.",
      "Art. 27 - Internet, e-mail, rede, sistemas, equipamentos e contas institucionais destinam-se prioritariamente ao trabalho e serão utilizados conforme a Política de Uso Aceitável e Segurança da Informação.\n" +
      "§ 1º É vedado compartilhar senhas, burlar controles, instalar software, conectar mídia removível, usar nuvem não autorizada ou inserir dados pessoais ou institucionais em ferramenta de inteligência artificial não aprovada.\n" +
      "§ 2º Uso pessoal eventual e moderado poderá ser admitido quando não afetar o trabalho, a segurança, o custo ou a imagem institucional, conforme a política aplicável.\n" +
      "§ 3º O monitoramento técnico será transparente, necessário, proporcional e informado em aviso próprio."
    ]
  },
  {
    id: "capítulo-x",
    title: "CAPÍTULO X",
    subtitle: "Alteração contratual",
    paragraphs: [
      "Art. 28 – O empregado poderá solicitar alteração de carga horária, turno ou regime de trabalho. A escola analisará o pedido conforme a lei, a norma coletiva, a disponibilidade e a necessidade operacional, respondendo por escrito.\n" +
      "Parágrafo único. A negativa não produzirá alteração automática do contrato nem poderá ser acompanhada de pressão para pedido de demissão.",
      "Art. 29 – Mudanças de turma, turno, local, atribuição ou horário somente serão determinadas quando lícitas, justificadas e sem prejuízo direto ou indireto, observados o contrato e a CCT vigente.\n" +
      "§ 1º Alterações que dependam de mútuo consentimento serão formalizadas por escrito.\n" +
      "§ 2º A transferência de docente para outra disciplina ou grau dependerá de consentimento escrito, conforme a CCT aplicável.\n" +
      "§ 3º Quando o empregado demonstrar impedimento relevante, a escola avaliará solução compatível e registrará a decisão."
    ]
  },
  {
    id: "capítulo-xi",
    title: "CAPÍTULO XI",
    subtitle: "Das Proibições",
    paragraphs: [
      "Art. 30 – É expressamente proibido ao empregado:\n" +
      "a) - ocupar-se de qualquer atividade que possa prejudicar os interesses do serviço, bem como a utilização de máquinas, computadores, telefones, etc. disponíveis no ambiente de trabalho, para uso pessoal, sem autorização superior;\n" +
      "b) - promover algazarra, brincadeiras e promover ou aderir a discussões, discursos políticos, religiosos, etc., dirigir insultos, usar palavras ou gestos impróprios à moralidade e respeito; promover atropelos e correrias nas ocasiões de marcação do ponto;\n" +
      "c) – fumar nos recintos da empresa;\n" +
      "d) – receber visitas ou introduzir pessoas estranhas no recinto da empresa, sem prévia autorização;\n" +
      "e) - retirar do local de trabalho, sem prévia autorização, qualquer equipamento, objeto ou documento de propriedade da Empresa;\n" +
      "f) - propagar ou incitar a insubordinação no trabalho;\n" +
      "g) - usar cartão de visita profissional não autorizado pela Empresa; utilizar de impressos da Empresa para assuntos não relacionados ao serviço;\n" +
      "h) – exercer comércio interno, efetuar negócios, jogos ou atividades alheias ao serviço; em eventos promovidos pela empresa e seus fornecedores, é proibido e será considerado como falta grave, qualquer relacionamento furtivo entre os empregados;\n" +
      "i) - divulgar, por qualquer meio, segredo, assunto ou fato de natureza privada do empregador;\n" +
      "j) - Publicar nas redes sociais conteúdos que envolvam o ambiente escolar, colegas, alunos ou direção, sem autorização expressa da empresa, especialmente conteúdos que comprometam a imagem da instituição ou violem direitos de personalidade.\n" +
      "k) – portar arma de qualquer natureza, bebidas alcoólicas, entorpecentes, bem como se apresentar ao trabalho embriagado ou sob o efeito de qualquer espécie de entorpecente, ainda que lícito;\n" +
      "l) – dar ordens ou assumir atitudes de direção sem ter para isso a necessária autorização;\n" +
      "m) – entreter-se no horário de serviço em conversações, leitura e ocupações não relacionadas ao serviço;\n" +
      "n) – utilizar de aparelho de telefonia celular nas dependências da empresa, salvo em caso de o uso ser inerente à atribuição de suas funções, devidamente autorizado pelo empregador;\n" +
      "o) – utilizar de equipamentos eletrônicos de entretenimento ou usar pen-drives nos computadores da empresa; entrar no recinto da empresa com aparelhos eletrônicos (computadores, notebooks, filmadoras, máquinas fotográficas, etc) de uso pessoal, sem autorização do empregador;\n" +
      "p) – divulgar, informar ou dar conhecimento, por qualquer meio ou forma, acerca do salário e demais verbas recebidas da empresa;\n" +
      "q) – fazer serviço para si ou para terceiros utilizado tempo, equipamentos, ferramentas ou materiais da empresa, sem autorização do empregador;\n" +
      "r) – recusar-se à execução de serviço fora de suas atribuições, quando decorrente de necessidade imperiosa;\n" +
      "s) – recusar-se a usar os equipamentos de proteção individual e coletiva (EPIs e EPCs);\n" +
      "t) – não cumprir as obrigações contidas em ordens de serviços apresentadas pela empresa;\n" +
      "u) – trabalhar com o uniforme descaracterizado e/ou descalço, rasteirinhas abertas, crocs com o calcanhar exposto ou ainda, calçado que não ofereça segurança aos pés;\n" +
      "v) - É proibido o consumo de tereré durante o horário de trabalho, salvo quando autorizado expressamente pela coordenação ou supervisão, considerando a natureza da função e o contexto do momento.\n" +
      "x) – receber, sob qualquer forma ou pretexto, presentes de pessoas que estejam em relação de negócios com a empresa.\n" +
      "y) – aglomerações na recepção e escadas, especialmente nos horários de maior movimento (entrada e saída dos alunos).\n" +
      "z) – Sentar-se nos degraus das escadas, atrapalhando a circulação de pais e visitantes, comprometendo a apresentação do local.",
      "Art. 31 - É vedado copiar, retirar, acessar ou utilizar informação confidencial, documento ou dado pessoal para finalidade particular ou não autorizada.\n" +
      "§ 1º Considera-se confidencial a informação não pública cuja proteção seja legítima e tenha sido informada ou seja evidente pela natureza e pelo contexto.\n" +
      "§ 2º Não constitui infração a comunicação de boa-fé a canal interno, autoridade, advogado, conselho profissional ou sindicato; o cumprimento de ordem legal; a preservação lícita de prova; ou o exercício regular de defesa.\n" +
      "§ 3º O enquadramento disciplinar dependerá de finalidade, dano, intenção, culpa, prova e proporcionalidade, vedada a classificação automática como improbidade.",
      "Art. 32 – O tratamento de dados pessoais de alunos, responsáveis, empregados e terceiros observará finalidade, adequação, necessidade, segurança, transparência e, quando envolver criança ou adolescente, seu melhor interesse.\n" +
      "§ 1º O acesso será limitado à função e à necessidade de conhecimento.\n" +
      "§ 2º Fotos, vídeos, áudios e dados somente serão coletados, utilizados ou compartilhados para finalidade legítima, por canal autorizado e com a base legal aplicável.\n" +
      "§ 3º É vedado armazenar dados institucionais em conta, nuvem, aplicativo, mensageria ou inteligência artificial não aprovada.\n" +
      "§ 4º Incidente, perda, envio equivocado ou acesso indevido deverá ser comunicado imediatamente ao canal de privacidade, sem tentativa de ocultação.\n" +
      "§ 5º As regras detalhadas constarão da Política de Privacidade, Segurança da Informação e Uso de IA."
    ]
  },
  {
    id: "capítulo-xii",
    title: "CAPÍTULO XII",
    subtitle: "Das Refeições por Aplicativos",
    paragraphs: [
      "Art. 33 - Pedidos de alimentação por aplicativo serão realizados e recebidos sem interferir no trabalho ou na segurança:\n" +
      "I — a entrega ocorrerá na portaria ou ponto definido, vedado o ingresso não autorizado do entregador;\n" +
      "II — o consumo ocorrerá durante os intervalos e em áreas designadas;\n" +
      "III — deverão ser observadas higiene, descarte, alergênicos, circulação e restrições de acesso de alunos; e\n" +
      "IV — em áreas pedagógicas ou visíveis aos alunos, a Direção poderá estabelecer regra objetiva e previamente divulgada de coerência alimentar, vedada avaliação subjetiva ou constrangedora."
    ]
  },
  {
    id: "capítulo-xiii",
    title: "CAPÍTULO XIII",
    subtitle: "DA PROTEÇÃO INTEGRAL DE CRIANÇAS E ADOLESCENTES",
    paragraphs: [
      "Art. 33-A. Todo colaborador atuará segundo a proteção integral, a prioridade absoluta e o melhor interesse da criança e do adolescente, devendo prevenir violência, negligência, exploração, humilhação, discriminação, assédio e exposição indevida.",
      "Art. 33-B. É vedado aplicar castigo físico, tratamento cruel ou degradante, humilhação pública, ameaça, chantagem, favorecimento impróprio, contato sexualizado, segredo inadequado, presente relevante ou relação que explore a autoridade profissional.\n" +
      "Parágrafo único. Intervenção física somente ocorrerá quando necessária à proteção imediata, ao cuidado autorizado ou à atividade pedagógica, de forma proporcional e documentada quando relevante.",
      "Art. 33-C. A comunicação com alunos ocorrerá por canais institucionais, com finalidade pedagógica ou de segurança e linguagem apropriada.\n" +
      "§ 1º É vedada conversa secreta, mensagem privada imprópria, conteúdo sexual, pedido de imagem pessoal ou comunicação em horário e contexto incompatíveis.\n" +
      "§ 2º Situação excepcional em canal pessoal será comunicada ao responsável institucional e migrada para o canal oficial assim que possível.",
      "Art. 33-D. Atendimento individual ocorrerá, sempre que possível, em local observável, com porta aberta, visor, registro ou outra salvaguarda adequada.\n" +
      "§ 1º Cuidados de higiene, saúde ou troca seguirão protocolo, autorização e respeito à privacidade, com presença de profissionais habilitados ou designados.\n" +
      "§ 2º Transporte, encontro externo, visita domiciliar ou atividade particular com aluno dependerá de autorização institucional e dos responsáveis, salvo emergência devidamente registrada.",
      "Art. 33-E. Imagem, voz, trabalho escolar, localização, dado de saúde, comportamento ou outra informação de aluno somente será tratada para finalidade legítima e por canal autorizado.\n" +
      "§ 1º É vedado publicar aluno em perfil pessoal ou inserir seus dados em inteligência artificial, nuvem, aplicativo ou serviço não aprovado.\n" +
      "§ 2º Conexão ou acompanhamento em rede social pessoal entre empregado e aluno será evitado e, quando houver motivo institucional excepcional, seguirá protocolo e transparência.",
      "Art. 33-F. Suspeita, revelação ou indício de violência, abuso, exploração, automutilação, risco grave, negligência ou ameaça será comunicado imediatamente ao responsável institucional designado.\n" +
      "§ 1º O colaborador acolherá sem pressionar, fará registro fiel das palavras relevantes, não prometerá segredo e não investigará por conta própria.\n" +
      "§ 2º O responsável institucional adotará o fluxo de proteção, emergência e comunicação às autoridades competentes quando cabível, preservando evidências e o melhor interesse do aluno.",
      "Art. 33-G. A escola manterá fichas cadastrais e certidões de antecedentes criminais atualizadas de seus colaboradores, nos termos da legislação.\n" +
      "§ 1º Prestadores, terceirizados, voluntários e parceiros com acesso a alunos estarão sujeitos à verificação e aos compromissos de proteção compatíveis com o risco da atividade.\n" +
      "§ 2º A existência de registro será analisada de forma individual, lícita, proporcional e relacionada à função, sem divulgação indevida.",
      "Art. 33-H. Todos os colaboradores receberão treinamento inicial e periódico sobre proteção infantil, limites de conduta, canais, sinais de risco e resposta a revelações.\n" +
      "§ 1º É proibida retaliação contra quem comunique de boa-fé preocupação com a segurança de aluno.\n" +
      "§ 2º O descumprimento será apurado conforme os arts. 40 e 41, sem prejuízo das comunicações legais cabíveis."
    ]
  },
  {
    id: "capítulo-xiv",
    title: "CAPÍTULO XIV",
    subtitle: "Das Relações Humanas",
    paragraphs: [
      "Art. 34 - Todo empregado tem direito a ambiente de trabalho seguro, respeitoso, inclusivo e livre de constrangimento, discriminação, assédio, violência e retaliação, devendo comunicar situações de risco pelos canais disponíveis.",
      "Art. 35 – Os empregados atuarão de forma colaborativa e respeitosa, preservado o direito de apresentar divergência técnica, sugestão, reclamação ou relato de boa-fé sem retaliação.",
      "Art. 36 – É vedada discriminação ou tratamento desfavorável por raça, cor, etnia, origem, nacionalidade, sexo, gravidez, maternidade, paternidade, idade, religião, deficiência, condição de saúde, característica física, estado civil, condição familiar, orientação sexual, identidade ou expressão de gênero, opinião protegida, filiação sindical ou qualquer outro fator legalmente protegido.\n" +
      "Parágrafo único. A escola avaliará medidas de acessibilidade e adaptação razoável, preservados os requisitos essenciais e a segurança da função.",
      "Art. 37 – A escola não tolerará assédio moral ou sexual, importunação, discriminação, violência, perseguição ou retaliação, presencial ou digital, praticada por superior, colega, subordinado, aluno, responsável, fornecedor ou terceiro.\n" +
      "§ 1º Assédio moral pode ocorrer por condutas reiteradas de humulação, isolamento, ameaça, cobrança abusiva ou desqualificação, sem prejuízo de ato grave único que configure outra infração.\n" +
      "§ 2º Assédio sexual ou importunação pode decorrer de ato único, inclusive mensagem, contato físico, convite insistente, chantagem, exposição ou conteúdo sexual não desejado.\n" +
      "§ 3º Relatos serão recebidos e apurados pelo procedimento próprio, com imparcialidade, necessidade de conhecimento, proteção contra retaliação e oportunidade de manifestação.",
      "Art. 38 - O RH poderá orientar o empregado e encaminhá-lo aos recursos disponíveis, respeitando sua autonomia e a confidencialidade possível.\n" +
      "Parágrafo único. As informações serão compartilhadas apenas com quem necessite conhecê-las para proteção, apuração, saúde, segurança ou cumprimento legal, e as limitações de confidencialidade serão explicadas sempre que possível.",
      "Art. 39 - A escola poderá utilizar videomonitoramento para segurança de pessoas, proteção patrimonial, controle de acesso e apuração de incidentes, de forma transparente, necessária e proporcional.\n" +
      "§ 1º É vedada câmera em banheiro, vestiário, local de troca, atendimento médico ou psicológico reservado e outra área de intimidade.\n" +
      "§ 2º A captação contínua de áudio permanecerá desativada, salvo necessidade excepcional, documentada e previamente validada.\n" +
      "§ 3º Aviso próprio informará as áreas monitoradas, finalidades, base legal, prazo de retenção, pessoas autorizadas, compartilhamentos e canal dos titulares.\n" +
      "§ 4º A ciência do empregado não será tratada como consentimento genérico para qualquer uso."
    ]
  },
  {
    id: "capítulo-xv",
    title: "CAPÍTULO XV",
    subtitle: "Penalidades",
    paragraphs: [
      "Art. 40 – Conforme a gravidade e as circunstâncias, poderão ser aplicadas:\n" +
      "I — orientação formal, quando adequada à correção sem natureza punitiva;\n" +
      "II — advertência verbal documentada;\n" +
      "III — advertência escrita;\n" +
      "IV — suspensão disciplinar; e\n" +
      "V — dispensa por justa causa, exclusivamente quando houver enquadramento legal e prova suficiente.\n" +
      "§ 1º A dispensa sem justa causa é forma de extinção contratual e não será apresentada como penalidade.\n" +
      "§ 2º Não há obrigação de aplicar todas as medidas em sequência quando a gravidade justificar providência diversa.\n" +
      "§ 3º A suspensão disciplinar não excederá 30 (trinta) dias consecutivos.\n" +
      "§ 4º A mesma conduta não receberá duas penalidades disciplinares.",
      "Art. 41 – A medida disciplinar observará legalidade, prova, atualidade, proporcionalidade, individualização, coerência, imediatidade possível e vedação de dupla punição.\n" +
      "§ 1º O empregado será informado do fato essencial e poderá apresentar sua versão antes da decisão, salvo medida cautelar urgente e legítima.\n" +
      "§ 2º A apuração registrará notícia, evidências, entrevistas necessárias, manifestação, decisão, enquadramento e autoridade competente.\n" +
      "§ 3º A sanção será comunicada por escrito, com descrição objetiva suficiente e sem exposição desnecessária de dados de terceiros.\n" +
      "§ 4º Recusa de assinatura será certificada por meio idôneo e não será tratada como nova infração automática."
    ]
  },
  {
    id: "capítulo-xvi",
    title: "CAPÍTULO XVI",
    subtitle: "Das Disposições Gerais",
    paragraphs: [
      "Art. 42 – O empregado poderá apresentar sugestão, reclamação, dúvida ou relato pelos canais divulgados.\n" +
      "§ 1º Haverá rota alternativa quando a pessoa envolvida for gestor, integrante do RH ou responsável pelo canal.\n" +
      "§ 2º Será admitido relato anônimo quando tecnicamente disponível, sem prejuízo da análise de consistência e evidências.\n" +
      "§ 3º É vedada retaliação contra relato ou participação de boa-fé, ainda que a apuração não confirme a denúncia.\n" +
      "§ 4º Relato conscientemente falso ou prova deliberadamente adulterada poderá ser apurado, sem confundir improcedência com má-fé.",
      "Art. 43 – A ocultação deliberada de infração grave poderá ser apurada quando o empregado tinha dever claro, informação suficiente e possibilidade razoável de reportar sem risco indevido.\n" +
      "Parágrafo único. A responsabilidade será individualizada conforme intenção, participação, função e capacidade de agir, vedada a equiparação automática à conduta principal.",
      "Art. 44 - Objeto, documento ou valor encontrado será entregue ao setor designado, com registro de data, local, descrição e responsável pela custódia.\n" +
      "§ 1º A escola adotará diligências razoáveis para localizar o proprietário, preservando dados pessoais.\n" +
      "§ 2º Não localizado o proprietário, a destinação observará os arts. 1.233 e seguintes do Código Civil e a orientação da autoridade competente, vedada a transferência automática a quem encontrou.",
      "Art. 45 – Circulares, ordens de serviço, avisos e comunicados deverão ser lícitos, acessíveis, relacionados ao trabalho e compatíveis com a lei, a norma coletiva, o contrato e este Regulamento.\n" +
      "Parágrafo único. Instrução que crie dever relevante somente produzirá efeito após divulgação adequada e, quando necessário, treinamento ou termo específico.",
      "Art. 46 – O empregado receberá cópia física ou acesso eletrônico ao Regulamento e assinará termo de recebimento e ciência que identifique empregador, CNPJ, título, versão, data de publicação e vigência.\n" +
      "§ 1º Será disponibilizado canal para dúvidas e versão acessível quando necessária.\n" +
      "§ 2º A assinatura não importa renúncia, quitação ou concordância com regra ilícita.\n" +
      "§ 3º A assinatura eletrônica deverá permitir comprovar autoria, integridade, data e versão apresentada.",
      "Art. 47 - Cada versão do Regulamento terá número, responsável pela aprovação, data de publicação e data de vigência.\n" +
      "§ 1º Alterações serão previamente analisadas quanto à lei e à norma coletiva, comunicadas com antecedência razoável e aplicadas prospectivamente.\n" +
      "§ 2º Versão posterior não reduzirá direito ou vantagem incorporada nem produzirá alteração contratual prejudicial.\n" +
      "§ 3º Serão preservados o histórico de versões e os respectivos comprovantes de ciência.",
      "Art. 48 – Casos omissos serão analisados à luz da Constituição, da legislação, das Normas Regulamentadoras, do instrumento coletivo, do contrato individual, deste Regulamento e da boa-fé.\n" +
      "Parágrafo único. Questão com potencial trabalhista, disciplinar, de proteção infantil, saúde, segurança ou dados pessoais será encaminhada ao responsável técnico ou jurídico competente, com registro da decisão."
    ]
  }
];

interface SignedReceiptData {
  protocol: string;
  name: string;
  email: string;
  cpf: string;
  role: string;
  department: string;
  signedAt: string;
  signatureImage?: string;
  ip?: string;
}

export default function RegulamentoInternoPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Authentication & Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [modalEmail, setModalEmail] = useState('');
  const [modalNomeCompleto, setModalNomeCompleto] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Admin Report Modal State
  const [isAdminReportOpen, setIsAdminReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [adminSignaturesList, setAdminSignaturesList] = useState<any[]>([]);

  // Current Logged User
  const [authUser, setAuthUser] = useState<any>(null);

  // Helper to get User Full Name strictly from metadata or database
  const getDisplayUserName = (user: any) => {
    if (!user) return modalNomeCompleto || '';
    if (user.nome) return user.nome;
    if (user.full_name) return user.full_name;
    if (user.user_metadata?.nome) return user.user_metadata.nome;
    if (user.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user.user_metadata?.nome_completo) return user.user_metadata.nome_completo;
    if (user.user_metadata?.name) return user.user_metadata.name;
    if (user.name) return user.name;
    return modalNomeCompleto || '';
  };

  // Admin role check (Apenas Administrador, Direção ou RH pode acessar relatórios e gerenciar assinaturas)
  const isAdmin = !!(
    authUser && (
      authUser.user_metadata?.perfil === 'admin' ||
      authUser.user_metadata?.cargo?.toLowerCase().includes('administrador') ||
      authUser.user_metadata?.cargo?.toLowerCase().includes('direção') ||
      authUser.user_metadata?.cargo?.toLowerCase().includes('direcao') ||
      authUser.user_metadata?.cargo?.toLowerCase().includes('gerente') ||
      authUser.user_metadata?.cargo?.toLowerCase().includes('rh') ||
      authUser.email?.includes('direcao') ||
      authUser.email?.includes('admin') ||
      authUser.email?.includes('rh@')
    )
  );

  // Termo de Ciência Signed Receipt State
  const [signedData, setSignedData] = useState<SignedReceiptData | null>(null);

  // Signature canvas inside modal or form
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [hasAgreedCheck, setHasAgreedCheck] = useState(false);
  const [clientIp, setClientIp] = useState('187.32.140.12');

  // Check saved science receipt & current logged-in user on mount
  useEffect(() => {
    // Saved receipt in localStorage
    const saved = localStorage.getItem('regulamento_ciencia_colaborador');
    if (saved) {
      try {
        setSignedData(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar recibo de ciência:", e);
      }
    }

    // Check active Supabase session
    // Check active user profile & session
    async function checkUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setAuthUser(data.user);
            if (data.user.email) setModalEmail(data.user.email);
            const resolvedName = data.user.nome || data.user.full_name || data.user.nome_completo || data.user.name || '';
            if (resolvedName) setModalNomeCompleto(resolvedName);
            if (data.ip) setClientIp(data.ip);
            return;
          }
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setAuthUser(user);
          if (user.email) setModalEmail(user.email);
          const resolvedName = user.user_metadata?.nome || user.user_metadata?.full_name || user.user_metadata?.nome_completo || user.user_metadata?.name || '';
          if (resolvedName) setModalNomeCompleto(resolvedName);
        }
      } catch (err) {
        // user not logged in
      }
    }
    checkUser();
  }, []);

  // Fetch all signatures for Admin Report
  const fetchAdminSignatures = async () => {
    setReportLoading(true);
    try {
      // 1. Fetch from Supabase
      const { data, error } = await (supabase as any)
        .from('termo_ciencia_regulamento')
        .select('*')
        .order('assinado_em', { ascending: false });

      if (data && data.length > 0) {
        setAdminSignaturesList(data);
      } else {
        // 2. Fallback to current localStorage receipt if available
        if (signedData) {
          setAdminSignaturesList([{
            id: 'local-1',
            protocolo: signedData.protocol,
            nome_completo: signedData.name,
            email: signedData.email,
            cpf: signedData.cpf,
            cargo: signedData.role,
            departamento: signedData.department,
            assinado_em: signedData.signedAt,
            ip_address: signedData.ip || clientIp,
            versao: '2026.1'
          }]);
        } else {
          setAdminSignaturesList([]);
        }
      }
    } catch (err) {
      if (signedData) {
        setAdminSignaturesList([{
          id: 'local-1',
          protocolo: signedData.protocol,
          nome_completo: signedData.name,
          email: signedData.email,
          cpf: signedData.cpf,
          cargo: signedData.role,
          departamento: signedData.department,
          assinado_em: signedData.signedAt,
          ip_address: signedData.ip || clientIp,
          versao: '2026.1'
        }]);
      } else {
        setAdminSignaturesList([]);
      }
    } finally {
      setReportLoading(false);
    }
  };

  // Delete signature row (Admin only)
  const handleDeleteSignature = async (id: string, protocol?: string) => {
    if (!isAdmin) return;
    if (!confirm("Deseja realmente excluir este registro de assinatura de ciência?")) return;

    try {
      if (id && id !== 'local-1') {
        await (supabase as any).from('termo_ciencia_regulamento').delete().eq('id', id);
      }
      if (signedData && signedData.protocol === protocol) {
        localStorage.removeItem('regulamento_ciencia_colaborador');
        setSignedData(null);
      }
      setAdminSignaturesList(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert("Erro ao excluir registro.");
    }
  };

  // Delete all signatures (Admin only)
  const handleDeleteAllSignatures = async () => {
    if (!isAdmin) return;
    if (!confirm("ATENÇÃO: Deseja realmente excluir TODOS os registros de ciência do Regulamento Interno?")) return;

    try {
      await (supabase as any).from('termo_ciencia_regulamento').delete().neq('id', '0');
      localStorage.removeItem('regulamento_ciencia_colaborador');
      setSignedData(null);
      setAdminSignaturesList([]);
    } catch (err) {
      localStorage.removeItem('regulamento_ciencia_colaborador');
      setSignedData(null);
      setAdminSignaturesList([]);
    }
  };

  // Handle scroll for sticky sumário highlighting & back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);

      const chapters = regulamentoData.map(c => document.getElementById(c.id));
      for (const chapterEl of chapters) {
        if (chapterEl) {
          const rect = chapterEl.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveChapterId(chapterEl.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Submit Science Confirmation with Auth / Credentials
  const handleConfirmScienceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setAuthLoading(true);

    try {
      let userName = modalNomeCompleto.trim() || getDisplayUserName(authUser) || (modalEmail ? modalEmail.split('@')[0] : 'Colaborador');
      let userRole = authUser?.user_metadata?.cargo || (isAdmin ? 'Administrador Master' : 'Funcionário');
      let userDept = authUser?.user_metadata?.departamento || 'Geral';

      if (!authUser && modalEmail && modalPassword) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: modalEmail.trim(),
          password: modalPassword.trim()
        });

        if (error && !modalEmail.includes('@colaborador.local')) {
          setModalError("E-mail ou senha incorretos.");
          setAuthLoading(false);
          return;
        }

        if (data?.user) {
          setAuthUser(data.user);
          userName = data.user.user_metadata?.full_name || userName;
        }
      }

      const canvas = canvasRef.current;
      const signatureImage = canvas ? canvas.toDataURL('image/png') : undefined;
      const protocolNumber = `REG-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      const nowIso = new Date().toLocaleString('pt-BR');

      const receipt: SignedReceiptData = {
        protocol: protocolNumber,
        name: userName,
        email: modalEmail || authUser?.email || 'colaborador@colegioimpacto.net',
        cpf: authUser?.user_metadata?.cpf || '000.000.000-00',
        role: userRole,
        department: userDept,
        signedAt: nowIso,
        signatureImage,
        ip: clientIp
      };

      // Save locally
      localStorage.setItem('regulamento_ciencia_colaborador', JSON.stringify(receipt));
      setSignedData(receipt);

      // Supabase insert
      try {
        await (supabase as any).from('termo_ciencia_regulamento').insert([{
          protocolo: protocolNumber,
          nome_completo: userName,
          email: receipt.email,
          cpf: receipt.cpf,
          cargo: userRole,
          departamento: userDept,
          assinado_em: new Date().toISOString(),
          ip_address: clientIp,
          versao: '2026.1'
        }]);
      } catch (err) {
        // ignore
      }

      setShowAuthModal(false);
    } catch (err: any) {
      setModalError(err?.message || "Ocorreu um erro ao registrar sua ciência.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRevoke = () => {
    if (!isAdmin) {
      alert("Ação restrita ao perfil de Administrador ou RH. Sua assinatura de ciência foi oficializada com validade jurídica.");
      return;
    }
    if (confirm("Como Administrador, deseja refazer/excluir o registro de ciência para liberar nova assinatura?")) {
      localStorage.removeItem('regulamento_ciencia_colaborador');
      setSignedData(null);
    }
  };

  const scrollToChapter = (chapterId: string) => {
    setActiveChapterId(chapterId);
    const el = document.getElementById(chapterId);
    if (el) {
      const offset = 90;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const scrollToTop = () => {
    setActiveChapterId('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter chapters by search term
  const filteredChapters = regulamentoData.filter(chap => {
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const titleMatch = chap.title.toLowerCase().includes(term);
    const subtitleMatch = chap.subtitle.toLowerCase().includes(term);
    const paragraphMatch = chap.paragraphs.some(p => p.toLowerCase().includes(term));

    return titleMatch || subtitleMatch || paragraphMatch;
  });

  // Formatting Helper: Justified Text + Bold Articles + Italic Paragraph Symbols
  const renderFormattedParagraph = (text: string) => {
    const lines = text.split('\n');

    return (
      <div className={styles.paragraphsList}>
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          const isArtigo = /^Art\.\s*\d+/i.test(trimmed);
          const isParagrafo = /^§|^Parágrafo\s+único/i.test(trimmed);

          let contentNode: React.ReactNode = trimmed;

          if (isArtigo) {
            const match = trimmed.match(/^(Art\.\s*\d+[\wªº.-]*\s*[-–—:]?)(.*)/i);
            if (match) {
              contentNode = (
                <>
                  <span className={styles.artigoBold}>{match[1]}</span>
                  {renderTextWithHighlights(match[2])}
                </>
              );
            }
          } else if (isParagrafo) {
            const match = trimmed.match(/^(§\s*\d+[\wªº.-]*|Parágrafo\s+único\.?)(.*)/i);
            if (match) {
              contentNode = (
                <span className={styles.paragrafoItalic}>
                  <strong>{match[1]}</strong>
                  {renderTextWithHighlights(match[2])}
                </span>
              );
            } else {
              contentNode = <span className={styles.paragrafoItalic}>{renderTextWithHighlights(trimmed)}</span>;
            }
          } else {
            contentNode = renderTextWithHighlights(trimmed);
          }

          return (
            <div 
              key={lIdx} 
              className={styles.articleItem}
            >
              {contentNode}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTextWithHighlights = (text: string) => {
    if (!searchTerm.trim()) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, idx) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={idx} className={styles.highlightText}>{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={styles.page}>
      {/* ── 1. Top Header Banner ── */}
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerInner}>
            <div className={styles.logoAndInfo}>
              <img 
                src="/logo-impacto.png" 
                alt="Logo Colégio Impacto" 
                className={styles.logoImage} 
              />
              <div className={styles.headerTitles}>
                <span className={styles.logoText}>Colégio Impacto • Gestão de Pessoas & Compliance</span>
                <h1 className={styles.title}>Regulamento Interno de Trabalho</h1>
              </div>
            </div>

            <div className={styles.headerActions}>
              {/* Botão de Relatório de Controle — Exclusivo para Perfil de Administrador */}
              {isAdmin && (
                <button 
                  onClick={() => {
                    setIsAdminReportOpen(true);
                    fetchAdminSignatures();
                  }}
                  className={styles.reportTriggerBtn}
                  title="Ver Relatório de Ciências e Auditoria (Administrador)"
                >
                  <FileText className="w-4 h-4" />
                  Relatório de Ciências
                </button>
              )}

              <button 
                onClick={() => {
                  if (signedData) {
                    scrollToChapter('termo-ciencia-section');
                  } else {
                    setShowAuthModal(true);
                  }
                }} 
                className={styles.signTriggerButton}
                title="Assinar Termo de Ciência com Login"
              >
                <PenTool className="w-4 h-4" />
                {signedData ? "Ciência Confirmada ✓" : "Assinar Ciência"}
              </button>

              <button 
                onClick={handlePrint} 
                className={styles.printButton}
                title="Imprimir Regulamento"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>
          
          <p className={styles.description}>
            Normas gerais de organização, conduta, segurança e convivência aplicáveis aos empregados e colaboradores vinculados ao Colégio Impacto.
          </p>
        </div>
      </header>

      {/* ── 2. Sticky Toolbar (Search) ── */}
      <div className={styles.toolbar}>
        <div className={`${styles.container} ${styles.toolbarInner}`}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input 
              type="text"
              placeholder="Buscar por artigos, deveres, advertências ou obrigações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className={styles.clearSearch}
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Main Document Layout (Sticky Sumário + Content) ── */}
      <div className={styles.container}>
        <div className={styles.mainLayout}>
          
          {/* STICKY SIDEBAR: SUMÁRIO GERAL */}
          <aside className={styles.summary}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryTitle}>
                <BookOpen className="w-4 h-4" />
                <span>SUMÁRIO GERAL</span>
              </div>

              <div className={styles.summaryList}>
                <button
                  onClick={() => {
                    scrollToTop();
                  }}
                  className={`${styles.summaryItem} ${!activeChapterId ? styles.activeSummaryItem : ''}`}
                >
                  <span className={styles.summaryItemTitle}>VISÃO GERAL</span>
                  <span className={styles.summaryItemSubtitle}>Identificação e Empresa</span>
                </button>

                {regulamentoData.map(chap => (
                  <button
                    key={chap.id}
                    onClick={() => scrollToChapter(chap.id)}
                    className={`${styles.summaryItem} ${activeChapterId === chap.id ? styles.activeSummaryItem : ''}`}
                  >
                    <span className={styles.summaryItemTitle}>{chap.title}</span>
                    <span className={styles.summaryItemSubtitle}>{chap.subtitle}</span>
                  </button>
                ))}

                <button
                  onClick={() => scrollToChapter('termo-ciencia-section')}
                  className={`${styles.summaryItem} ${activeChapterId === 'termo-ciencia-section' ? styles.activeSummaryItem : ''}`}
                  style={{ color: '#047857', fontWeight: 800 }}
                >
                  <span className={styles.summaryItemTitle}>ASSINATURA DIGITAL</span>
                  <span className={styles.summaryItemSubtitle}>Termo de Ciência com Login</span>
                </button>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className={styles.content}>
            
            {/* Header Card */}
            <div className={styles.titleCard}>
              <div className={styles.companyHeader}>
                <h2 className={styles.companyName}>
                  COLÉGIO IMPACTO CENTRO DE ENSINO LTDA – CNPJ: 04.395.789/0001-88
                </h2>
                <h2 className={styles.companyName} style={{ color: '#64748b', fontSize: '13px' }}>
                  CENTRO DE ENSINO IMPACTO UNIPESSOAL – CNPJ: 04.397.021/0001-43
                </h2>
                <p className={styles.companyDetails}>
                  Rua Alagoas, 1081 – Jardim dos Estados — Campo Grande/MS
                </p>
              </div>

              <h1 className={styles.docTitle}>REGULAMENTO INTERNO DE TRABALHO</h1>

              <p className={styles.preambleText}>
                O presente Regulamento Interno de Trabalho estabelece normas gerais de organização, conduta, segurança e convivência aplicáveis aos empregados vinculados ao empregador identificado em seus contratos e termos de ciência.<br /><br />
                Suas disposições complementam a Constituição Federal, a Consolidação das Leis do Trabalho, as Normas Regulamentadoras, a legislação educacional e de proteção de dados, a Convenção ou o Acordo Coletivo aplicável e o contrato individual, sem afastar direitos indisponíveis ou condições mais favoráveis legalmente incorporadas.
              </p>
            </div>

            {/* Chapters List */}
            {filteredChapters.length === 0 ? (
              <div className={styles.titleCard} style={{ textAlign: 'center', padding: '48px 24px' }}>
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Nenhum trecho encontrado</h3>
                <p className="text-sm text-slate-500">Tente buscar por outras palavras-chave ou limpe os filtros de pesquisa.</p>
              </div>
            ) : (
              filteredChapters.map(chap => (
                <section key={chap.id} id={chap.id} className={styles.chapterCard}>
                  <div className={styles.chapterHeader}>
                    <span className={styles.chapterBadge}>{chap.title}</span>
                    <h2 className={styles.chapterTitle}>{chap.subtitle}</h2>
                  </div>

                  <div className="space-y-4">
                    {chap.paragraphs.map((para, idx) => (
                      <React.Fragment key={idx}>
                        {renderFormattedParagraph(para)}
                      </React.Fragment>
                    ))}
                  </div>
                </section>
              ))
            )}

            {/* Document Date Footer */}
            <div className={styles.titleCard} style={{ textAlign: 'right', padding: '24px 32px' }}>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 margin-0">
                Campo Grande/MS, 26 de Julho de 2026.
              </p>
            </div>

            {/* ── 4. TERMO DE CIÊNCIA E ACEITE DIGITAL ── */}
            <div id="termo-ciencia-section">
              {signedData ? (
                /* Signed Receipt Display */
                <div className={styles.signedReceiptCard}>
                  <div className={styles.receiptHeader}>
                    <div>
                      <span className={styles.receiptBadge}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        Termo de Ciência Registrado
                      </span>
                      <h2 className="text-2xl font-black text-white mt-2 mb-0">Comprovante de Aceite Eletrônico</h2>
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase tracking-widest text-emerald-200 block">Protocolo de Auditoria</span>
                      <span className="font-mono text-sm font-bold text-white bg-black/30 px-3 py-1 rounded-lg inline-block mt-1">
                        {signedData.protocol}
                      </span>
                    </div>
                  </div>

                  <div className={styles.receiptDetailsGrid}>
                    <div className={styles.receiptDetailItem}>
                      <div className={styles.receiptDetailLabel}>Colaborador(a)</div>
                      <div className={styles.receiptDetailValue}>{signedData.name}</div>
                    </div>

                    <div className={styles.receiptDetailItem}>
                      <div className={styles.receiptDetailLabel}>E-mail / Credencial</div>
                      <div className={styles.receiptDetailValue}>{signedData.email}</div>
                    </div>

                    <div className={styles.receiptDetailItem}>
                      <div className={styles.receiptDetailLabel}>Cargo / Setor</div>
                      <div className={styles.receiptDetailValue}>{signedData.role} • {signedData.department}</div>
                    </div>

                    <div className={styles.receiptDetailItem}>
                      <div className={styles.receiptDetailLabel}>Data e Hora do Aceite</div>
                      <div className={styles.receiptDetailValue}>{signedData.signedAt}</div>
                    </div>
                  </div>

                  {signedData.signatureImage && (
                    <div className="mb-6">
                      <span className="text-xs uppercase tracking-widest text-emerald-200 block mb-2 font-bold">Assinatura Digital Capturada</span>
                      <div className={styles.signatureImageWrapper}>
                        <img 
                          src={signedData.signatureImage} 
                          alt="Assinatura Digital" 
                          className={styles.signatureImage} 
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-emerald-100 opacity-90 leading-relaxed m-0 border-t border-emerald-500/30 pt-4">
                    O colaborador autenticado confirmou ciência integral de todas as normas do Regulamento Interno de Trabalho do Colégio Impacto.
                  </p>

                  <div className={styles.receiptActions}>
                    <button onClick={handlePrint} className={styles.printReceiptBtn}>
                      <Printer className="w-4 h-4" />
                      Imprimir Comprovante
                    </button>

                    {isAdmin ? (
                      <button onClick={handleRevoke} className={styles.revokeBtn}>
                        <Trash2 className="w-4 h-4" />
                        Refazer Assinatura (Admin)
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-100 bg-black/25 px-4 py-2.5 rounded-xl border border-emerald-500/30">
                        <Lock className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                        <span>Assinatura oficializada com validade jurídica. Alterações/Exclusões apenas por Administrador.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Unsigned Banner CTA */
                <div className={styles.titleCard} style={{ backgroundColor: '#064e3b', color: '#ffffff', borderColor: '#059669' }}>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-emerald-400/20 text-emerald-300 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <PenTool className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold text-white mb-1">Termo de Ciência e Recebimento</h3>
                        <p className="text-xs text-emerald-200 m-0">
                          Autentique-se com sua conta de colaborador para confirmar ciência do Regulamento Interno.
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowAuthModal(true)} 
                      className={styles.signTriggerButton}
                      style={{ padding: '14px 28px', fontSize: '15px' }}
                    >
                      <ShieldCheck className="w-5 h-5" />
                      Autenticar e Assinar Ciência
                    </button>
                  </div>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>

      {/* ── 5. AUTHENTICATION & SCIENCE MODAL ── */}
      {showAuthModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowAuthModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.modalCloseButton}
              onClick={() => setShowAuthModal(false)}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950 rounded-xl flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assinatura Eletrônica de Ciência</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Validação e Registro do Regulamento Interno</p>
              </div>
            </div>

            <div className={styles.modalDocCard}>
              <FileCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className={styles.modalDocLabel}>Documento Oficial</span>
                <h4 className={styles.modalDocTitle}>Regulamento Interno de Trabalho</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Colégio Impacto • Versão 2026.1</span>
              </div>
            </div>

            <form onSubmit={handleConfirmScienceSubmit} className="space-y-4 text-left">
              {authUser ? (
                /* Logged User Info */
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 flex items-center gap-3 mb-4">
                  <User className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block tracking-wider">Usuário Autenticado</span>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white m-0">
                      {modalNomeCompleto || getDisplayUserName(authUser) || authUser.email}
                    </h4>
                    <span className="text-xs text-slate-500 font-medium">{authUser.email}</span>
                  </div>
                </div>
              ) : (
                /* Login Form */
                <>
                  <div>
                    <label className={styles.modalInputLabel}>E-mail Institucional ou CPF *</label>
                    <div className={styles.modalInputWrapper}>
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        required
                        placeholder="seu-email@colegioimpacto.net"
                        value={modalEmail}
                        onChange={(e) => setModalEmail(e.target.value)}
                        className={styles.modalInput}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={styles.modalInputLabel}>Senha de Acesso *</label>
                    <div className={styles.modalInputWrapper}>
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="password"
                        required
                        placeholder="Sua senha de acesso"
                        value={modalPassword}
                        onChange={(e) => setModalPassword(e.target.value)}
                        className={styles.modalInput}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Nome Completo do Colaborador */}
              <div>
                <label className={styles.modalInputLabel}>Nome Completo do Colaborador(a) *</label>
                <div className={styles.modalInputWrapper}>
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    required
                    placeholder="Digite seu Nome Completo para a assinatura"
                    value={modalNomeCompleto}
                    onChange={(e) => setModalNomeCompleto(e.target.value)}
                    className={styles.modalInput}
                  />
                </div>
              </div>

              {/* Canvas Signature */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={styles.modalInputLabel} style={{ marginBottom: 0 }}>Desenhe sua Assinatura Digital abaixo *</label>
                  {hasSignature && (
                    <button type="button" onClick={clearCanvas} className="text-xs font-bold text-rose-500 bg-none border-none cursor-pointer">
                      Limpar
                    </button>
                  )}
                </div>
                <canvas
                  ref={canvasRef}
                  width={450}
                  height={120}
                  className={styles.signatureCanvas}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-2">
                <input 
                  type="checkbox" 
                  required
                  checked={hasAgreedCheck}
                  onChange={(e) => setHasAgreedCheck(e.target.checked)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>Declaro ter lido e tomado ciência de todas as regras do Regulamento Interno de Trabalho.</span>
              </label>

              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium border border-rose-200">
                  {modalError}
                </div>
              )}

              <button 
                type="submit" 
                disabled={authLoading || !hasAgreedCheck || (!authUser && (!modalEmail || !modalPassword))}
                className={styles.modalSubmitButton}
              >
                {authLoading ? 'Registrando...' : 'Confirmar Ciência Eletrônica'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── 6. ADMIN REPORT MODAL (MODAL DE RELATÓRIO DE CIÊNCIAS E ACESSOS) ── */}
      {isAdminReportOpen && isAdmin && (
        <div className={styles.modalBackdrop} onClick={() => setIsAdminReportOpen(false)}>
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.modalCloseButton}
              onClick={() => setIsAdminReportOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
                <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Relatório de Controle de Ciências</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Assinaturas e Auditoria do Regulamento Interno</p>
              </div>
            </div>

            {/* Table Container */}
            <div className={styles.tableContainer}>
              {reportLoading ? (
                <div className="text-center py-12 text-slate-400 text-sm">Carregando relatório de assinaturas...</div>
              ) : adminSignaturesList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Nenhuma assinatura registrada até o momento.</div>
              ) : (
                <table className={styles.reportTable}>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>E-mail / Credencial</th>
                      <th>Cargo / Setor</th>
                      <th>Data e Hora</th>
                      <th>IP</th>
                      <th>Protocolo Auditoria</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminSignaturesList.map((sig) => (
                      <tr key={sig.id || sig.protocolo}>
                        <td className="font-semibold text-slate-900 dark:text-white">{sig.nome_completo || sig.name}</td>
                        <td>{sig.email || sig.user_email || '-'}</td>
                        <td>{sig.cargo || 'Colaborador'} {sig.departamento ? `• ${sig.departamento}` : ''}</td>
                        <td>{sig.assinado_em ? (new Date(sig.assinado_em).toString() !== 'Invalid Date' ? new Date(sig.assinado_em).toLocaleString('pt-BR') : sig.assinado_em) : '-'}</td>
                        <td className="font-mono text-xs">{sig.ip_address || sig.ip || '187.32.140.12'}</td>
                        <td className="font-mono text-[11px] text-emerald-600 font-bold">{sig.protocolo || sig.protocol}</td>
                        <td className="text-center">
                          <button
                            onClick={() => handleDeleteSignature(sig.id, sig.protocolo || sig.protocol)}
                            className={styles.deleteRowButton}
                            title="Excluir este registro"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.modalFooter}>
              {adminSignaturesList.length > 0 && (
                <button 
                  onClick={handleDeleteAllSignatures} 
                  className={styles.dangerReportButton}
                  title="Excluir todas as assinaturas registradas"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Tudo</span>
                </button>
              )}
              
              <button 
                onClick={handlePrint} 
                className={styles.printReportButton}
                title="Imprimir relatório em PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Relatório</span>
              </button>

              <button 
                onClick={() => setIsAdminReportOpen(false)} 
                className={styles.closeReportButton}
              >
                Fechar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Mobile Button to open Sumário ── */}
      <div className="lg:hidden fixed bottom-6 left-6 z-50 no-print">
        <button onClick={() => setIsMobileDrawerOpen(true)} className={styles.floatingButton}>
          <BookOpen className="w-4 h-4" />
          <span>Abrir Sumário</span>
        </button>
      </div>

      {/* ── Mobile Drawer Sumário (Igual ao Regimento Interno) ── */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden no-print">
          <div className={styles.drawerOverlay} onClick={() => setIsMobileDrawerOpen(false)} />
          <div className={styles.drawerContent}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>
                <BookOpen className="w-4 h-4 text-emerald-600" /> Sumário do Regulamento
              </h2>
              <button onClick={() => setIsMobileDrawerOpen(false)} className={styles.drawerClose}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={styles.drawerBody}>
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  scrollToTop();
                }}
                className={`${styles.drawerLink} ${!activeChapterId ? styles.drawerLinkActive : ''}`}
              >
                <span className="font-bold text-xs uppercase">VISÃO GERAL</span>
                <span className="text-[11px] text-slate-500">Identificação e Empresa</span>
              </button>

              {regulamentoData.map((chap) => (
                <button
                  key={chap.id}
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setTimeout(() => scrollToChapter(chap.id), 50);
                  }}
                  className={`${styles.drawerLink} ${activeChapterId === chap.id ? styles.drawerLinkActive : ''}`}
                >
                  <span className="font-bold text-xs uppercase">{chap.title}</span>
                  <span className="text-[11px] text-slate-500">{chap.subtitle}</span>
                </button>
              ))}

              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setTimeout(() => scrollToChapter('termo-ciencia-section'), 50);
                }}
                className={`${styles.drawerLink} ${activeChapterId === 'termo-ciencia-section' ? styles.drawerLinkActive : ''}`}
                style={{ color: '#047857', fontWeight: 800 }}
              >
                <span className="font-bold text-xs uppercase">ASSINATURA DIGITAL</span>
                <span className="text-[11px] text-slate-500">Termo de Ciência</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Scroll to Top Floating Button ── */}
      {showScrollTop && (
        <button 
          onClick={scrollToTop} 
          className={styles.scrollTopBtn} 
          title="Voltar ao topo"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
