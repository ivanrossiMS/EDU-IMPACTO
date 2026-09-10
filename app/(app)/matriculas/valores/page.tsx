'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calculator, Sparkles, MessageSquare, Copy, Send, Check,
  Printer, Layers, DollarSign, Calendar,
  Percent, ArrowRight, ShieldCheck, CheckCircle2,
  FileSpreadsheet, Award, BookOpen,
  Search, HeartHandshake, Phone, User,
  CheckCheck, GraduationCap, ChevronRight, HelpCircle,
  Clock, ArrowUpRight, Sparkle, Tag, RotateCcw, X, Loader2,
  Users, UserCheck, Settings, Save, Edit3, Plus, Trash2, CheckSquare,
  Camera, Download, FileText, Utensils
} from 'lucide-react'
import { useConfigDb } from '@/lib/useConfigDb'
import AmpliacaoPeriodoTab from './components/AmpliacaoPeriodoTab'

// --- Tipagens de Dados ---
interface SeriePricing {
  id: string
  nome: string
  detalhe?: string
  segmento: 'Villa Baby' | 'Educação Infantil' | 'Fundamental I' | 'Fundamental II' | 'Ensino Médio' | 'Período Estendido'
  mensalidadeBase: number
  anuidadeBase: number
  taxaMaterial?: number
  taxaMaterialDesc?: string
}

export interface ResponsavelOption {
  id: string
  tipo: string
  nome: string
  telefone: string
}

export interface StudentSearchResult {
  id: string
  rawId?: string
  nomeAluno: string
  turma: string
  origem: 'aluno' | 'responsavel'
  responsaveis: ResponsavelOption[]
}

export interface ValoresWhatsAppTemplate {
  id: string
  titulo: string
  descricao?: string
  conteudo: string
}

// Modelos Oficiais de WhatsApp
const DEFAULT_VALORES_TEMPLATES: ValoresWhatsAppTemplate[] = [
  {
    id: 'proposta-valores',
    titulo: 'PROPOSTA NOVOS ALUNOS (2027)',
    descricao: 'Orçamento com mensalidade promocional, matrícula e benefícios pedagógicos.',
    conteudo: `🏫 *COLÉGIO IMPACTO • ANO LETIVO 2027*
📋 *Proposta de Matrícula & Valores*

Olá! Tudo bem?
Seguem as informações e valores detalhados para o Colégio Impacto:

💰 *MENSALIDADES & BENEFÍCIOS:*
• Formação de excelência com acompanhamento pedagógico individualizado
• Condições promocionais de campanha com desconto especial por pontualidade
• Projetos socioemocionais, metodologia ativa e estrutura moderna

🎁 *MATRÍCULA ANTECIPADA:*
• Condições especiais de campanha por tempo limitado
💳 *Parcelamento facilitado da matrícula em até 5x sem juros no cartão de crédito.*

Estamos à inteira disposição para agendar uma visita guiada e formalizar a matrícula!
📍 *Colégio Impacto* – Educação que transforma! ✨`
  },
  {
    id: 'rematriculas',
    titulo: 'REMATRÍCULAS VETERANOS (2027)',
    descricao: 'Condições exclusivas e prioritárias para renovação de alunos da casa.',
    conteudo: `🎒 *COLÉGIO IMPACTO • REMATRÍCULAS 2027*
🌟 *Condições Exclusivas para Alunos Veteranos*

Olá! Tudo bem?
Apresentamos as condições especiais de Rematrícula para o Ano Letivo 2027:

💰 *MENSALIDADES & VANTAGENS:*
• Tabela promocional com condições prioritárias para famílias parceiras
• Continuidade pedagógica, projetos socioemocionais e inovação constante

🎁 *REMATRÍCULA ANTECIPADA:*
• Condições com descontos exclusivos de antecipação
💳 *Parcelamento facilitado em até 5x no cartão de crédito sem juros.*

As condições promocionais e a garantia da vaga no turno atual são exclusivas durante a campanha. Vamos garantir a vaga para 2027?
📍 *Colégio Impacto* – Onde o futuro começa hoje! 💙`
  },
  {
    id: 'documentacao',
    titulo: 'DOCUMENTAÇÃO PARA MATRÍCULA',
    descricao: 'Checklist completo de documentos do aluno e responsáveis.',
    conteudo: `📋 *COLÉGIO IMPACTO • DOCUMENTAÇÃO DE MATRÍCULA 2027*

Olá! Tudo bem?
Para efetivar a matrícula, segue a relação de documentos necessários:

👤 *Do Aluno:*
• Certidão de Nascimento / RG e CPF do aluno
• 1 Foto 3x4 recente
• Declaração de Transferência ou Histórico Escolar original
• Declaração de Quitação da escola anterior
• Cópia da Carteira de Vacinação atualizada
• Laudo médico ou relatório de saúde (quando aplicável)

👥 *Dos Responsáveis (Financeiro e Pedagógico):*
• Cópia do RG e CPF
• Comprovante de Residência recente (água, luz ou gás)

📍 *Atendimento Secretaria:* Segunda a Sexta, das 07h30 às 18h00.
Dúvidas ou envio de documentos digitais: basta nos responder por este WhatsApp! 🏫✨`
  },
  {
    id: 'extras',
    titulo: 'AULAS EXTRACURRICULARES',
    descricao: 'Modalidades esportivas e artísticas disponíveis no contraturno escolar.',
    conteudo: `⚽🎨 *COLÉGIO IMPACTO • AULAS EXTRACURRICULARES 2027*

Desenvolvimento motor, criatividade, disciplina e muita integração para os estudantes!

🌟 *Modalidades Disponíveis:*
🩰 *Ballet*
💃 *Jazz*
⚽ *Futsal*
🥋 *Judô*
🤸‍♀️ *Ginástica Rítmica*

💰 *Investimento:* *R$ 180,00 / mês*
⏰ *Frequência:* 2 aulas por semana
📌 *Observação:* Os horários de cada turma serão alinhados e confirmados no início do ano letivo.

Deseja garantir a pré-inscrição do seu filho(a) em alguma das modalidades? Ficamos à disposição! 💙`
  },
  {
    id: 'inicio-aulas',
    titulo: 'INÍCIO DAS AULAS 2027',
    descricao: 'Cronograma oficial de volta às aulas separado por segmento.',
    conteudo: `🗓️🔔 *COLÉGIO IMPACTO • INÍCIO DAS AULAS 2027*

Confira o calendário oficial de início do Ano Letivo 2027 para cada segmento:

👶 *Villa Baby (Níveis 1 e 2):*
📅 Início: *12/01/2027*

🧸 *Educação Infantil (Níveis 3 a 5) & Fundamental I (1º ao 5º ano):*
📅 Início: *26/01/2027*

📚 *Ensino Fundamental II (6º ao 9º ano):*
📅 Início: *28/01/2027*

🎓 *Ensino Médio (1ª a 3ª série - Terceirão):*
📅 Início: *02/02/2027*

Estamos preparando um ano letivo repleto de aprendizado, descobertas e conquistas! Sejam muito bem-vindos! 🏫🎒✨`
  },
  {
    id: 'horarios',
    titulo: 'HORÁRIOS DE ENTRADA E SAÍDA',
    descricao: 'Horários dos turnos da manhã, tarde, integral e períodos de tolerância.',
    conteudo: `⏰🚪 *COLÉGIO IMPACTO • HORÁRIOS DE ENTRADA E SAÍDA*

Organize a rotina da sua família com os horários de funcionamento das aulas:

🧸 *Educação Infantil:*
• Matutino: *07h00 às 11h00*
• Vespertino: *13h00 às 17h00*

📘 *Ensino Fundamental I (1º ao 5º ano):*
• Matutino: *07h00 às 11h20*
• Vespertino: *13h00 às 17h20*

🌟 *Período Integral (Infantil e Fundamental):*
• Horário: *07h00 às 17h20*

📗 *Ensino Fundamental II (6º ao 9º ano):*
• Matutino: *07h00 às 11h30*
• Vespertino: *13h00 às 17h30*

🎓 *Ensino Médio:*
• Turno Manhã: *07h00 às 12h30*

⏳ *Tolerância de Saída:*
• Turno Matutino: *até às 12h20*
• Turno Vespertino e Integral: *até às 18h20*

A pontualidade contribui diretamente com o rendimento e a segurança de todos os alunos! 🏫💙`
  },
  {
    id: 'descontos',
    titulo: 'DESCONTOS PARA FAMÍLIAS',
    descricao: 'Benefícios para irmãos, servidores públicos e diálogo com a direção.',
    conteudo: `🎉💙 *COLÉGIO IMPACTO • DESCONTOS ESPECIAIS PARA SUA FAMÍLIA!*

Oferecemos condições especiais para você fazer parte da nossa comunidade escolar:

👨‍👩‍👧‍👦 *Desconto Irmãos:*
• *10% de desconto* na mensalidade para um dos irmãos!

👩‍💼 *Funcionários Públicos:*
• *11% de desconto* nas mensalidades para *todos os filhos!*

🏫✨ *Visita Presencial:*
Venha conhecer de perto nossa estrutura e descobrir tudo o que nossa proposta pedagógica oferece para o pleno desenvolvimento do seu filho!

💬 *Na visita, converse pessoalmente com a direção sobre a possibilidade de um desconto especial para sua família!*

📲 Agende sua visita e venha fazer parte da família Colégio Impacto! 💙`
  },
  {
    id: 'garantia-vaga',
    titulo: 'GARANTIA DE VAGA (REMATRÍCULAS)',
    descricao: 'Aviso sobre prioridade de vaga até 30/11 e abertura para externos.',
    conteudo: `📢💙 *COLÉGIO IMPACTO • GARANTA A VAGA DO SEU FILHO!*

📅 *Até 30/11*, nossos alunos têm prioridade exclusiva para renovar a matrícula com vaga e turno garantidos!

⚠️ *Atenção:* Após essa data, abriremos as matrículas para *novos alunos*, que poderão ocupar as vagas dos estudantes que ainda não tiverem concluído a rematrícula.

💳 *Facilite seu planejamento:*
• Parcelamento facilitado da matrícula em até *5x sem juros no cartão de crédito!*

✍️ *Importante:*
A rematrícula só será efetivada e a vaga garantida após a confirmação do pagamento e a assinatura do contrato.

Não deixe para a última hora! Queremos continuar construindo momentos e grandes conquistas com sua família! 🏫🎒💙`
  },
  {
    id: 'integral',
    titulo: 'ATIVIDADES NO INTEGRAL',
    descricao: 'Grade pedagógica, lúdica e de apoio nas atividades do contraturno.',
    conteudo: `🌟🏫 *COLÉGIO IMPACTO • ATIVIDADES NO PERÍODO INTEGRAL*

Uma rotina enriquecedora, acolhedora e segura com diversas atividades inclusas:

♟️ *Xadrez:* Estímulo ao raciocínio lógico, foco e tomada de decisões
🇬🇧 *Inglês:* Vivência do idioma de forma natural e interativa
📚 *Reforço & Tarefas:* Supervisão diária e acompanhamento nos deveres de casa
🏃 *Recreação & Atividades Físicas:* Esportes, expressão corporal e convivência
🍎 *Alimentação:* Cardápio equilibrado com almoço e lanches nutritivos

Mais tranquilidade para o seu dia a dia e um desenvolvimento pleno para o seu filho! Venha conhecer! 💙`
  },
  {
    id: 'transferencia',
    titulo: 'ORIENTAÇÕES DE TRANSFERÊNCIA',
    descricao: 'Procedimentos regimentais para solicitação de transferência.',
    conteudo: `📄🏛️ *COLÉGIO IMPACTO • INFORMAÇÕES DE TRANSFERÊNCIA*

Para a formalização de transferência escolar, seguem as orientações da nossa secretaria:

1️⃣ *Requerimento Formal:*
O pedido de transferência deverá ser formalizado por escrito através de requerimento solicitado presencialmente na secretaria da escola.

2️⃣ *Regularização Financeira:*
O contratante deverá realizar o pagamento das parcelas vencidas, a do mês da rescisão, bem como a quitação da taxa rescisória prevista no contrato de prestação de serviços educacionais.

3️⃣ *Prazos de Documentação:*
• *Declaração Provisória de Transferência:* Emitida de imediato no ato do requerimento.
• *Guia Original de Transferência / Histórico:* Prazo de até *15 dias* para expedição.

Qualquer dúvida, nossa secretaria está à disposição para orientar! 🏫`
  },
  {
    id: 'provas-2ch',
    titulo: '2ª CHAMADA DE PROVAS',
    descricao: 'Normas, taxa por matéria e agendamento de avaliação substitutiva.',
    conteudo: `📝📌 *COLÉGIO IMPACTO • 2ª CHAMADA DE PROVAS*

Olá! Para solicitar a 2ª chamada de prova por ausência justificada, confira o procedimento:

📱 *Como Solicitar:*
O requerimento pode ser solicitado diretamente por aqui no WhatsApp (enviamos o documento para assinatura digital) ou presencialmente na secretaria da escola.

💰 *Taxa de Avaliação:*
• *R$ 40,00 por matéria*, a ser quitado no ato do requerimento.

📅 *Agendamento:*
Após a confirmação da taxa e do pedido, a coordenadora pedagógica agendará a data e o horário da avaliação substitutiva.

Fique atento aos prazos escolares para requerer sua prova! Ficamos à disposição. 🏫📚`
  },
  {
    id: 'ensino',
    titulo: 'ENSINO DO COLÉGIO IMPACTO',
    descricao: 'Apresentação da proposta pedagógica, valores e compromisso com o futuro.',
    conteudo: `💙✨ *COLÉGIO IMPACTO • APRENDER COM PROFUNDIDADE*

*Aprender com profundidade. Crescer com confiança. Preparar-se para a vida.*

No *Colégio Impacto*, o futuro começa com uma base sólida de conhecimento. Valorizamos o ensino estruturado com metodologia que:
🧠 Estimula o raciocínio lógico e o pensamento crítico
💡 Fortalece a autonomia e as habilidades socioemocionais
🎯 Prepara cada estudante com excelência para os grandes vestibulares e para o mundo

Nossa missão vai além dos conteúdos: buscamos formar pessoas preparadas para pensar por si mesmas, tomar decisões conscientes e liderar seus caminhos.

🏫 Venha nos visitar e descobrir como podemos fazer parte da história de conquistas do seu filho! 🚀`
  },
  {
    id: 'material',
    titulo: 'LIVROS E SISTEMAS DIDÁTICOS',
    descricao: 'Materiais pedagógicos: Sistema BRINCANDO (Brasil) e Sistema pH.',
    conteudo: `📚✨ *COLÉGIO IMPACTO • LIVROS E SISTEMAS DIDÁTICOS*

Cada etapa do aprendizado merece uma base forte para impulsionar novas conquistas!

🧩 *Educação Infantil e Fundamental I (Nível 2 ao 5º ano):*
Adotamos o *Sistema de Ensino BRINCANDO, da Editora Brasil*, com proposta pedagógica moderna que conecta o aprendizado às necessidades da criança, despertando o prazer de aprender!

🎓 *Ensino Fundamental II e Ensino Médio (6º ano ao Terceirão):*
Contamos com o prestigiado *Sistema de Ensino pH*, reconhecido nacionalmente pelos conteúdos de excelência e resultados de destaque no *ENEM e principais vestibulares*.

💙 Unimos aluno no centro, capacitação docente e material de excelência para transformar potencial em aprovação e sucesso! 🚀`
  },
  {
    id: 'visita',
    titulo: 'AGENDAMENTO DE VISITA GUIADA',
    descricao: 'Convite acolhedor para a família conhecer as instalações e a coordenação.',
    conteudo: `🏫☕ *COLÉGIO IMPACTO • AGENDAMENTO DE VISITA GUIADA*

Olá! É uma alegria imensa receber o seu contato com o *Colégio Impacto*! ✨

Aqui unimos excelência acadêmica, acolhimento socioemocional e estrutura completa para o pleno desenvolvimento do seu filho(a).

Gostaríamos de convidá-los para um café especial e uma *Visita Guiada Personalizada* com a nossa Equipe de Coordenação:
🗓 *Disponibilidade:* Segunda a Sexta-feira
⏰ *Horários flexíveis:* Manhã ou Tarde

Qual seria o melhor dia e horário para recebê-los com carinho? Ficamos à disposição! 💙🎒`
  },
  {
    id: 'contrato-online',
    titulo: 'ASSINATURA DIGITAL DO CONTRATO',
    descricao: 'Instruções para conclusão rápida e digital da matrícula.',
    conteudo: `📱✍️ *COLÉGIO IMPACTO • ASSINATURA DIGITAL DO CONTRATO*

Olá! Parabéns por dar esse passo tão importante no futuro do seu filho(a)! 🎉📚

Para sua total comodidade e segurança, a efetivação da matrícula é 100% online:

📲 *Como Concluir em Poucos Minutos:*
1️⃣ Acesse o link enviado no seu WhatsApp/E-mail
2️⃣ Confira os dados cadastrais e as condições do plano contratado
3️⃣ Clique em "Assinar Digitalmente" na própria tela do seu smartphone
4️⃣ Conclua o pagamento da matrícula (PIX, Boleto ou em até 5x no Cartão sem juros)

Nossa secretaria segue à disposição para auxiliá-lo em qualquer etapa! 🏫✨`
  },
  {
    id: 'vivencia',
    titulo: 'DIA DE VIVÊNCIA & AULA EXPERIMENTAL',
    descricao: 'Convite para o aluno participar de um dia de oficinas práticas gratuitas.',
    conteudo: `🎨🔬 *COLÉGIO IMPACTO • DIA DE VIVÊNCIA & AULA EXPERIMENTAL*

Olá! Que tal proporcionar uma experiência inesquecível para o seu filho(a)? ✨

Convidamos ele(a) para passar uma manhã ou tarde conosco em um *Dia de Vivência no Colégio Impacto*!

Nesse dia especial, ele(a) poderá:
✅ Participar de oficinas práticas (Laboratório de Ciências, Robótica e Maker)
✅ Conhecer a nossa metodologia de perto e interagir com os professores
✅ Fazer novos amigos em um ambiente acolhedor e estimulante

Tudo 100% gratuito e sem compromisso! Qual dia da próxima semana seria ideal para agendarmos? 📅🎒✨`
  }
]




const DEFAULT_SERIES_2027: SeriePricing[] = [
  {
    id: 'integral',
    nome: 'Integral',
    detalhe: 'Almoço incluído',
    segmento: 'Período Estendido',
    mensalidadeBase: 2195.00,
    anuidadeBase: 26340.00,
    taxaMaterial: 480.00,
    taxaMaterialDesc: 'Taxa de Material (anual)'
  },
  {
    id: 'intermediario',
    nome: 'Intermediário',
    detalhe: 'Almoço incluído',
    segmento: 'Período Estendido',
    mensalidadeBase: 1895.00,
    anuidadeBase: 22740.00,
    taxaMaterial: 480.00,
    taxaMaterialDesc: 'Taxa de Material (anual)'
  },
  {
    id: 'villa-baby-n1',
    nome: 'Nível 1/Nivel 2 (Meio Período)',
    detalhe: '',
    segmento: 'Villa Baby',
    mensalidadeBase: 1395.00,
    anuidadeBase: 16740.00,
    taxaMaterial: 480.00,
    taxaMaterialDesc: 'Taxa N1 (R$ 480) ou Livros N2 (R$ 600)'
  },
  {
    id: 'ed-infantil',
    nome: 'Nível 3 ao Nível 5 (Meio Período)',
    detalhe: '',
    segmento: 'Educação Infantil',
    mensalidadeBase: 1230.00,
    anuidadeBase: 14760.00,
    taxaMaterial: 1285.00,
    taxaMaterialDesc: 'Livros didáticos + LIV (Nível 3 ao Nível 5)'
  },
  {
    id: 'fund-1',
    nome: '1º ao 5º ano (Meio Período)',
    detalhe: '',
    segmento: 'Fundamental I',
    mensalidadeBase: 1230.00,
    anuidadeBase: 14760.00,
    taxaMaterial: 1585.00,
    taxaMaterialDesc: 'Livros didáticos + LIV (1º ao 5º ano)'
  },
  {
    id: 'fund-2',
    nome: '6º ao 9º ano (Meio Período)',
    detalhe: '',
    segmento: 'Fundamental II',
    mensalidadeBase: 1330.00,
    anuidadeBase: 15960.00,
    taxaMaterial: 1985.00,
    taxaMaterialDesc: 'Apostilas (6º ao 9º ano)'
  },
  {
    id: 'em-1-2',
    nome: 'Ensino Médio 1ª e 2ª séries',
    detalhe: '',
    segmento: 'Ensino Médio',
    mensalidadeBase: 1545.00,
    anuidadeBase: 18540.00,
    taxaMaterial: 2150.00,
    taxaMaterialDesc: 'Apostilas (1ª a 3ª série - Ensino Médio)'
  },
  {
    id: 'em-3',
    nome: 'Ensino Médio 3ª série',
    detalhe: '',
    segmento: 'Ensino Médio',
    mensalidadeBase: 1625.00,
    anuidadeBase: 19500.00,
    taxaMaterial: 2150.00,
    taxaMaterialDesc: 'Apostilas (1ª a 3ª série - Ensino Médio)'
  }
]

const CONVENIOS = [
  { nome: 'Funcionário público', desconto: 11, desc: 'Servidores municipais, estaduais e federais' },
  { nome: 'Sebrae', desconto: 11, desc: 'Colaboradores e dependentes Sebrae' },
  { nome: 'Tendência', desconto: 11, desc: 'Parceria corporativa Tendência' },
  { nome: 'Brasil Telecom / Oi', desconto: 11, desc: 'Convênio corporativo de telecomunicações' },
  { nome: 'Forças Armadas em geral', desconto: 11, desc: 'Exército, Marinha e Aeronáutica' },
  { nome: 'Irmãos / Familiar (2º filho)', desconto: 10, desc: 'Desconto a partir do segundo filho matriculado' },
  { nome: 'Irmãos / Familiar (3º filho+)', desconto: 15, desc: 'Desconto a partir do terceiro filho matriculado' },
]

const ANTECIPACAO_REGRAS = [
  {
    mes: 'Outubro',
    tag: 'Campanha de Ouro',
    aVistaPct: 20,
    parceladoPct: 15,
    maxParcelas: 5,
    destaque: 'Até 20% OFF',
    corBg: '#ecfdf5',
    corBorder: '#a7f3d0',
    corText: '#065f46',
    descricao: '20% à vista ou 15% em até 5x'
  },
  {
    mes: 'Novembro',
    tag: 'Condição Especial',
    aVistaPct: 15,
    parceladoPct: 10,
    maxParcelas: 5,
    destaque: 'Até 15% OFF',
    corBg: '#eff6ff',
    corBorder: '#bfdbfe',
    corText: '#1e40af',
    descricao: '15% à vista ou 10% em até 5x'
  },
  {
    mes: 'Dezembro',
    tag: 'Última Chance',
    aVistaPct: 10,
    parceladoPct: 5,
    maxParcelas: 5,
    destaque: 'Até 10% OFF',
    corBg: '#fffbeb',
    corBorder: '#fde68a',
    corText: '#92400e',
    descricao: '10% à vista ou 5% em até 5x'
  },
  {
    mes: 'Regular',
    tag: 'Tabela Padrão',
    aVistaPct: 0,
    parceladoPct: 0,
    maxParcelas: 1,
    destaque: 'Sem desconto',
    corBg: '#f8fafc',
    corBorder: '#e2e8f0',
    corText: '#475569',
    descricao: 'Valor integral'
  },
  {
    mes: 'Todas',
    tag: 'Cronograma Geral',
    aVistaPct: 20,
    parceladoPct: 15,
    maxParcelas: 5,
    destaque: 'Todas as Opções',
    corBg: '#fdf4ff',
    corBorder: '#f0abfc',
    corText: '#86198f',
    descricao: 'Out, Nov, Dez e Regular'
  }
]

export interface MaterialOption {
  id: string
  nome: string
  segmento: string
  valor: number
  tipo?: string
}

const OPCOES_MATERIAIS: MaterialOption[] = [
  { id: 'mat-n1', nome: 'Taxa de Material (Nível 1)', segmento: 'Nível 1/Nivel 2 • Berçário (N1)', valor: 480.00, tipo: 'anual' },
  { id: 'mat-n2', nome: 'Livros didáticos (Nível 2)', segmento: 'Nível 1/Nivel 2 • Maternal (N2)', valor: 600.00, tipo: 'anual' },
  { id: 'mat-n3-n5', nome: 'Livros didáticos + LIV (Nível 3 ao Nível 5)', segmento: 'Nível 3 ao Nível 5 (Educação Infantil)', valor: 1285.00, tipo: 'anual' },
  { id: 'mat-fund1', nome: 'Livros didáticos + LIV (1º ao 5º ano)', segmento: '1º ao 5º ano (Ensino Fundamental I)', valor: 1585.00, tipo: 'anual' },
  { id: 'mat-fund2', nome: 'Apostilas (6º ao 9º ano)', segmento: '6º ao 9º ano (Ensino Fundamental II)', valor: 1985.00, tipo: 'anual' },
  { id: 'mat-medio', nome: 'Apostilas (1ª a 3ª série - Ensino Médio)', segmento: 'Ensino Médio (1ª a 3ª série)', valor: 2150.00, tipo: 'anual' },
]

function getDefaultMaterialIdsForSeries(series: SeriePricing[]): string[] {
  const ids: string[] = []
  for (const s of series) {
    if (s.id === 'villa-baby-n1' || s.id === 'villa-baby-n2' || s.id === 'integral' || s.id === 'intermediario') {
      if (!ids.includes('mat-n1')) ids.push('mat-n1')
    } else if (s.id === 'ed-infantil') {
      if (!ids.includes('mat-n3-n5')) ids.push('mat-n3-n5')
    } else if (s.id === 'fund-1') {
      if (!ids.includes('mat-fund1')) ids.push('mat-fund1')
    } else if (s.id === 'fund-2') {
      if (!ids.includes('mat-fund2')) ids.push('mat-fund2')
    } else if (s.id === 'em-1-2' || s.id === 'em-3') {
      if (!ids.includes('mat-medio')) ids.push('mat-medio')
    }
  }
  return ids.length > 0 ? ids : ['mat-n1']
}

const SERVICOS_ADICIONAIS = {
  diariaComAlmoco: 100.00,
  diariaSemAlmoco: 75.00,
  dpPorMateria: 300.00,
  extracurricularMensal: 180.00,
  atividadesExtracurriculares: ['Ballet', 'Jazz', 'Futsal', 'Ginástica Rítmica'],
  // Serviços de Material e Livros Didáticos Oficiais
  taxaMaterialNivel1: 480.00,
  livrosDidaticosNivel2: 600.00,
  livrosDidaticosLIVNivel3a5: 1285.00,
  livrosDidaticosLIVFund1: 1585.00,
  apostilasFund2: 1985.00,
  apostilasEnsinoMedio: 2150.00,
  tabelaServicosMateriais: OPCOES_MATERIAIS
}

const IDADES_POR_NIVEL = [
  { nivel: 'Nível II', idade: '2 anos', obs: 'Idade completa até 31 de março de 2027' },
  { nivel: 'Nível III', idade: '3 anos', obs: 'Idade completa até 31 de março de 2027' },
  { nivel: 'Nível IV', idade: '4 anos', obs: 'Idade completa até 31 de março de 2027' },
  { nivel: 'Nível V', idade: '5 anos', obs: 'Idade completa até 31 de março de 2027' },
]

function formatPhoneNumber(val: any): string {
  if (!val) return ''
  const digits = String(val).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

function detectSerieIdFromTurma(turmaOrSerie: string): string | null {
  if (!turmaOrSerie) return null
  const t = turmaOrSerie.toLowerCase()
  if (t.includes('integral')) return 'integral'
  if (t.includes('intermed')) return 'intermediario'
  // Ensino Médio
  if (t.includes('3ª série') || t.includes('3a serie') || t.includes('terceir') || t.includes('3º em') || t.includes('3º médio') || t.includes('vestibular')) return 'em-3'
  if (t.includes('1ª série') || t.includes('1a serie') || t.includes('1º em') || t.includes('1º médio') ||
      t.includes('2ª série') || t.includes('2a serie') || t.includes('2º em') || t.includes('2º médio') ||
      t.includes('1ª e 2ª') || t.includes('1a e 2a') || t.includes('médio') || t.includes('medio')) return 'em-1-2'
  // 6º ao 9º ano (Fundamental II)
  if (t.includes('6º') || t.includes('7º') || t.includes('8º') || t.includes('9º') ||
      t.includes('6o') || t.includes('7o') || t.includes('8o') || t.includes('9o') ||
      t.includes('fund 2') || t.includes('fundamental 2') || t.includes('fundamental ii')) return 'fund-2'
  // 1º ao 5º ano (Fundamental I)
  if (t.includes('1º') || t.includes('2º') || t.includes('3º') || t.includes('4º') || t.includes('5º') ||
      t.includes('1o') || t.includes('2o') || t.includes('3o') || t.includes('4o') || t.includes('5o') ||
      t.includes('fund 1') || t.includes('fundamental 1') || t.includes('fundamental i')) return 'fund-1'
  // Nível 3 ao Nível 5 (Educação Infantil)
  if (t.includes('infantil') || t.includes('n3') || t.includes('n4') || t.includes('n5') || t.includes('nível 3') || t.includes('nível 4') || t.includes('nível 5')) return 'ed-infantil'
  // Nível 1/Nivel 2 (Villa Baby)
  if (t.includes('n1') || t.includes('n2') || t.includes('maternal') || t.includes('berçario') || t.includes('bercario') || t.includes('baby') || t.includes('berçário') || t.includes('nível 1') || t.includes('nível 2')) return 'villa-baby-n1'
  return null
}

const formatListWithAnd = (items: string[]) => {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} e ${items[1]}`
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

interface PropostaBadgeProps {
  children: React.ReactNode
  icon?: React.ReactNode
  bg?: string
  border?: string
  color?: string
  fontSize?: number | string
  fontWeight?: number | string
  minHeight?: number | string
  padding?: string
  borderRadius?: number | string
  style?: React.CSSProperties
  className?: string
}

function PropostaBadge({
  children,
  icon,
  bg = '#f1f5f9',
  border,
  color = '#475569',
  fontSize = 10,
  fontWeight = 800,
  minHeight,
  padding = '3px 8px',
  borderRadius,
  style,
  className = ''
}: PropostaBadgeProps) {
  // Evita o bug de distorção em formato de ovo/elipse do html2canvas limitando o radius à metade da altura real do badge (~10-12px)
  const resolvedRadius = borderRadius !== undefined
    ? (typeof borderRadius === 'number' && borderRadius > 30 ? 11 : borderRadius)
    : 11

  return (
    <span
      className={`proposta-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        verticalAlign: 'middle',
        gap: 5,
        width: 'fit-content',
        maxWidth: 'max-content',
        minWidth: 0,
        minHeight: minHeight ?? 'auto',
        padding,
        borderRadius: resolvedRadius,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        flexShrink: 0,
        boxSizing: 'border-box',
        background: bg,
        border: border ? `1px solid ${border}` : 'none',
        color,
        fontSize,
        fontWeight,
        ...style
      }}
    >
      {icon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            lineHeight: 1,
            verticalAlign: 'middle'
          }}
        >
          {icon}
        </span>
      )}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          verticalAlign: 'middle'
        }}
      >
        {children}
      </span>
    </span>
  )
}

export default function ValoresPage() {
  const [activeTab, setActiveTab] = useState<'simulador' | 'tabela-matriculas' | 'matriz-mensalidades' | 'ampliacao-periodo' | 'servicos'>('simulador')
  const [anoLetivo, setAnoLetivo] = useState<string>('2027')
  const [seriesList] = useState<SeriePricing[]>(DEFAULT_SERIES_2027)

  // Sincronização e Persistência no Banco de Dados (Supabase) via useConfigDb
  const { data: dbTemplates = [], setData: setDbTemplates, loading: loadingTemplates } = useConfigDb<ValoresWhatsAppTemplate>('cfgWhatsAppValores', DEFAULT_VALORES_TEMPLATES)
  const templates = useMemo(() => {
    if (!dbTemplates || dbTemplates.length === 0) return DEFAULT_VALORES_TEMPLATES
    return dbTemplates
  }, [dbTemplates])

  // Mapa de Turmas (Código/ID -> Nome) carregado do banco
  const [turmasMap, setTurmasMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/turmas?all=true')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!json) return
        const list = Array.isArray(json) ? json : (json.data || [])
        const map: Record<string, string> = {}
        for (const t of list) {
          if (t.id && t.nome) map[String(t.id)] = t.nome
          if (t.codigo && t.nome) map[String(t.codigo)] = t.nome
          if (t.nome) map[String(t.nome)] = t.nome
        }
        setTurmasMap(map)
      })
      .catch(err => console.error('Erro ao carregar mapa de turmas:', err))
  }, [])

  // Estados do Simulador
  const [selectedSerieIds, setSelectedSerieIds] = useState<string[]>(['integral'])
  const [descontoPercent, setDescontoPercent] = useState<number>(0)
  const [convenioSelecionado, setConvenioSelecionado] = useState<string>('')
  const [selectedMeses, setSelectedMeses] = useState<string[]>(['Outubro', 'Novembro', 'Dezembro', 'Regular'])
  const [formaMatricula, setFormaMatricula] = useState<'avista' | 'parcelado' | 'ambos'>('ambos')
  const [numParcelasMatricula, setNumParcelasMatricula] = useState<number>(5)

  // Status de Seleção de Etapas da Campanha
  const isAllMeses = selectedMeses.length === 4
  const isMultiMeses = selectedMeses.length > 1
  const mesAntecipacao = isAllMeses ? 'Todas' : (selectedMeses.length === 1 ? selectedMeses[0] : selectedMeses.join(', '))

  // Informações do Aluno / Responsável
  const [nomeAluno, setNomeAluno] = useState<string>('')
  const [nomeResponsavel, setNomeResponsavel] = useState<string>('')
  const [telefone, setTelefone] = useState<string>('')

  // Busca de Alunos e Responsáveis no ERP
  const [studentSearchInput, setStudentSearchInput] = useState<string>('')
  const [isSearchingStudents, setIsSearchingStudents] = useState<boolean>(false)
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState<boolean>(false)
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchResult[]>([])
  const [availableResponsaveis, setAvailableResponsaveis] = useState<ResponsavelOption[]>([])
  const [selectedResponsavelId, setSelectedResponsavelId] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const propostaCardRef = useRef<HTMLDivElement>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false)
  const [pdfSavedSuccess, setPdfSavedSuccess] = useState<boolean>(false)
  const [isCopyingProposal, setIsCopyingProposal] = useState<boolean>(false)
  const [proposalCopiedSuccess, setProposalCopiedSuccess] = useState<boolean>(false)

  // Opcionais
  const [incluirMaterial, setIncluirMaterial] = useState<boolean>(false)
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(['mat-n1'])
  const [incluirExtracurricular, setIncluirExtracurricular] = useState<boolean>(false)
  const selectedAtividadesExtras = SERVICOS_ADICIONAIS.atividadesExtracurriculares
  const [incluirDP, setIncluirDP] = useState<boolean>(false)
  const [numMateriasDP, setNumMateriasDP] = useState<number>(1)

  const handleToggleMaterial = (matId: string) => {
    setSelectedMaterialIds(prev => {
      if (prev.includes(matId)) {
        return prev.filter(id => id !== matId)
      } else {
        return [...prev, matId]
      }
    })
  }

  const handleToggleIncluirMaterial = (checked: boolean) => {
    setIncluirMaterial(checked)
    if (checked && selectedMaterialIds.length === 0) {
      setSelectedMaterialIds(getDefaultMaterialIdsForSeries(selectedSeries))
    }
  }

  const handleToggleIncluirExtracurricular = (checked: boolean) => {
    setIncluirExtracurricular(checked)
  }

  // Modelo de WhatsApp Selecionado
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('proposta-valores')
  const [customMsgOverride, setCustomMsgOverride] = useState<string>('')
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modal de Edição de Modelos
  const [isEditorModalOpen, setIsEditorModalOpen] = useState<boolean>(false)
  const [editingTemplate, setEditingTemplate] = useState<ValoresWhatsAppTemplate | null>(null)
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false)
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Busca de Séries
  const [searchQuery, setSearchQuery] = useState<string>('')

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const extractResponsaveisDoAluno = (a: any): ResponsavelOption[] => {
    const list: ResponsavelOption[] = []

    const addOrMergeResp = (tipo: string, nome: any, tel: any, id?: string) => {
      if (!nome || typeof nome !== 'string') return
      const cleanNome = nome.trim()
      if (!cleanNome || cleanNome.length < 2) return
      
      const cleanTel = (tel && String(tel).trim()) ? formatPhoneNumber(String(tel).trim()) : ''

      const existing = list.find(r => r.nome.toLowerCase() === cleanNome.toLowerCase())
      if (existing) {
        if (!existing.telefone && cleanTel) existing.telefone = cleanTel
        if (existing.tipo === 'Responsável' && tipo !== 'Responsável') existing.tipo = tipo
        if (id && !existing.id.startsWith('resp-db-')) existing.id = id
        return
      }

      list.push({
        id: id || `resp-${list.length + 1}-${Math.random().toString(36).substring(2, 6)}`,
        tipo,
        nome: cleanNome,
        telefone: cleanTel
      })
    }

    if (Array.isArray(a.responsaveis)) {
      for (const r of a.responsaveis) {
        if (r && r.nome) {
          let tipo = 'Responsável'
          if (r.isFinanceiro || r.resp_financeiro || r.respFinanceiro) tipo = 'Resp. Financeiro'
          else if (r.isPedagogico || r.resp_pedagogico || r.respPedagogico) tipo = 'Resp. Pedagógico'
          else if (r.parentesco) tipo = r.parentesco.charAt(0).toUpperCase() + r.parentesco.slice(1)

          addOrMergeResp(tipo, r.nome, r.telefone || r.celular || r.tel, r.id)
        }
      }
    }

    const rfNome = a.responsavel_financeiro || a.dados?.responsavel_financeiro?.nome || a.dados?.responsavelFinanceiro?.nome
    const rfTel = a.tel_responsavel_financeiro || a.dados?.responsavel_financeiro?.celular || a.dados?.responsavel_financeiro?.telefone || a.dados?.responsavelFinanceiro?.celular || a.dados?.responsavelFinanceiro?.telefone
    if (rfNome) addOrMergeResp('Resp. Financeiro', rfNome, rfTel)

    const maeNome = a.dados?.mae?.nome || a.dados?.filiacao1?.nome
    const maeTel = a.dados?.mae?.celular || a.dados?.mae?.telefone || a.dados?.filiacao1?.celular || a.dados?.filiacao1?.telefone
    if (maeNome) addOrMergeResp('Mãe', maeNome, maeTel)

    const paiNome = a.dados?.pai?.nome || a.dados?.filiacao2?.nome
    const paiTel = a.dados?.pai?.celular || a.dados?.pai?.telefone || a.dados?.filiacao2?.celular || a.dados?.filiacao2?.telefone
    if (paiNome) addOrMergeResp('Pai', paiNome, paiTel)

    const rpNome = a.responsavel_pedagogico || a.dados?.responsavel_pedagogico?.nome || a.dados?.responsavelPedagogico?.nome
    const rpTel = a.tel_responsavel_pedagogico || a.dados?.responsavel_pedagogico?.celular || a.dados?.responsavel_pedagogico?.telefone || a.dados?.responsavelPedagogico?.celular || a.dados?.responsavelPedagogico?.telefone
    if (rpNome) addOrMergeResp('Resp. Pedagógico', rpNome, rpTel)

    if (Array.isArray(a.dados?.responsaveis)) {
      for (const r of a.dados.responsaveis) {
        if (r && r.nome) addOrMergeResp(r.parentesco || r.tipo || 'Responsável', r.nome, r.celular || r.telefone, r.id)
      }
    }

    if (a.responsavel) addOrMergeResp('Responsável', a.responsavel, a.telefone || a.tel_responsavel)

    return list
  }

  useEffect(() => {
    const q = studentSearchInput.trim()
    if (q.length < 2) {
      setStudentSearchResults([])
      setIsSearchingStudents(false)
      return
    }

    setIsSearchingStudents(true)
    const timeoutId = setTimeout(async () => {
      try {
        const [alunosRes, respRes] = await Promise.allSettled([
          fetch(`/api/alunos?search=${encodeURIComponent(q)}&limit=10`),
          fetch(`/api/responsaveis?search=${encodeURIComponent(q)}&limit=10`)
        ])

        const combined: StudentSearchResult[] = []

        if (alunosRes.status === 'fulfilled' && alunosRes.value.ok) {
          const json = await alunosRes.value.json()
          const list = Array.isArray(json) ? json : (json.data || [])
          for (const a of list) {
            const responsaveis = extractResponsaveisDoAluno(a)
            const turmaNome = a.turma_nome || turmasMap[String(a.turma)] || turmasMap[String(a.dados?.turma)] || a.turma || a.serie || ''
            combined.push({
              id: `aluno-${a.id}`,
              rawId: String(a.id),
              nomeAluno: a.nome || '',
              turma: turmaNome,
              origem: 'aluno',
              responsaveis
            })
          }
        }

        if (respRes.status === 'fulfilled' && respRes.value.ok) {
          const json = await respRes.value.json()
          const list = Array.isArray(json) ? json : (json.data || [])
          for (const r of list) {
            const tel = r.telefone || r.celular || ''
            const respNome = r.nome || ''
            const respOption: ResponsavelOption = {
              id: `resp-db-${r.id}`,
              tipo: 'Responsável',
              nome: respNome,
              telefone: formatPhoneNumber(tel)
            }

            if (Array.isArray(r.alunos) && r.alunos.length > 0) {
              for (const a of r.alunos) {
                const turmaNome = a.turma_nome || turmasMap[String(a.turma)] || turmasMap[String(a.dados?.turma)] || a.turma || a.serie || ''
                const existing = combined.find(c => c.nomeAluno.toLowerCase() === (a.nome || '').toLowerCase())
                if (existing) {
                  if (!existing.turma && turmaNome) existing.turma = turmaNome
                  const match = existing.responsaveis.find(res => res.nome.toLowerCase() === respNome.toLowerCase())
                  if (match) {
                    if (tel) match.telefone = formatPhoneNumber(tel)
                  } else {
                    existing.responsaveis.push(respOption)
                  }
                } else {
                  combined.push({
                    id: `resp-${r.id}-${a.id || Math.random()}`,
                    rawId: String(a.id || ''),
                    nomeAluno: a.nome || '',
                    turma: turmaNome,
                    origem: 'responsavel',
                    responsaveis: [respOption]
                  })
                }
              }
            } else {
              combined.push({
                id: `resp-only-${r.id}`,
                nomeAluno: '',
                turma: '',
                origem: 'responsavel',
                responsaveis: [respOption]
              })
            }
          }
        }

        setStudentSearchResults(combined.slice(0, 10))
        setIsStudentDropdownOpen(true)
      } catch (err) {
        console.error('Erro na busca de alunos/responsáveis:', err)
      } finally {
        setIsSearchingStudents(false)
      }
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [studentSearchInput])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsStudentDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectStudent = (student: StudentSearchResult, specificResp?: ResponsavelOption) => {
    setNomeAluno(student.nomeAluno)
    setAvailableResponsaveis(student.responsaveis)

    const detectedSerie = detectSerieIdFromTurma(student.turma)
    if (detectedSerie) setSelectedSerieIds([detectedSerie])

    const targetResp = specificResp || student.responsaveis.find(r => !!r.telefone) || student.responsaveis[0]
    if (targetResp) {
      setSelectedResponsavelId(targetResp.id)
      setNomeResponsavel(targetResp.nome)
      setTelefone(formatPhoneNumber(targetResp.telefone))
    } else {
      setSelectedResponsavelId(null)
      setNomeResponsavel('')
      setTelefone('')
    }

    setStudentSearchInput(student.nomeAluno || targetResp?.nome || '')
    setIsStudentDropdownOpen(false)

    if (student.rawId) {
      fetch(`/api/alunos/${encodeURIComponent(student.rawId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(detail => {
          if (detail && Array.isArray(detail.responsaveis) && detail.responsaveis.length > 0) {
            const detailedList: ResponsavelOption[] = detail.responsaveis.map((r: any, idx: number) => {
              let tipo = 'Responsável'
              if (r.isFinanceiro || r.resp_financeiro || r.respFinanceiro) tipo = 'Resp. Financeiro'
              else if (r.isPedagogico || r.resp_pedagogico || r.respPedagogico) tipo = 'Resp. Pedagógico'
              else if (r.parentesco) tipo = r.parentesco.charAt(0).toUpperCase() + r.parentesco.slice(1)

              return {
                id: r.id || `resp-detail-${idx}`,
                tipo,
                nome: r.nome || '',
                telefone: formatPhoneNumber(r.telefone || r.celular || r.tel || '')
              }
            }).filter((r: ResponsavelOption) => r.nome && r.nome.length > 1)

            if (detailedList.length > 0) {
              setAvailableResponsaveis(detailedList)
              const activeName = (specificResp?.nome || targetResp?.nome || '').toLowerCase()
              const match = detailedList.find(r => r.nome.toLowerCase() === activeName) || detailedList[0]
              if (match) {
                setSelectedResponsavelId(match.id)
                setNomeResponsavel(match.nome)
                if (match.telefone) setTelefone(match.telefone)
              }
            }
          }
        })
        .catch(err => console.error('Erro ao buscar detalhes do aluno:', err))
    }
  }

  const handleSelectResponsavelPill = (resp: ResponsavelOption) => {
    setSelectedResponsavelId(resp.id)
    setNomeResponsavel(resp.nome)
    setTelefone(formatPhoneNumber(resp.telefone))
  }

  const handleClearStudent = () => {
    setNomeAluno('')
    setNomeResponsavel('')
    setTelefone('')
    setStudentSearchInput('')
    setAvailableResponsaveis([])
    setSelectedResponsavelId(null)
    setSelectedSerieIds(['integral'])
    setIncluirMaterial(false)
    setSelectedMaterialIds(['mat-n1'])
    setIncluirDP(false)
    setNumMateriasDP(1)
  }

  // Ordem de apresentação nos textos e propostas:
  // Primeiro as séries de Meio Período (Educação Infantil ao Ensino Médio), depois Intermediário e depois Integral
  const getSerieOrderPriority = (id: string): number => {
    if (id === 'villa-baby-n1' || id === 'villa-baby-n2' || id === 'villa-baby') return 10
    if (id === 'ed-infantil') return 20
    if (id === 'fund-1') return 30
    if (id === 'fund-2') return 40
    if (id === 'em-1-2' || id === 'em-1' || id === 'em-2') return 50
    if (id === 'em-3') return 60
    if (id === 'intermediario') return 90
    if (id === 'integral') return 100
    return 70
  }

  const selectedSeries = useMemo(() => {
    const list = seriesList.filter(s =>
      selectedSerieIds.includes(s.id) ||
      (selectedSerieIds.includes('em-2') && s.id === 'em-1-2') ||
      (selectedSerieIds.includes('em-1') && s.id === 'em-1-2') ||
      (selectedSerieIds.includes('villa-baby') && s.id === 'villa-baby-n1') ||
      (selectedSerieIds.includes('villa-baby-n2') && s.id === 'villa-baby-n1')
    )
    const sorted = [...list].sort((a, b) => getSerieOrderPriority(a.id) - getSerieOrderPriority(b.id))
    return sorted.length > 0 ? sorted : [seriesList[0]]
  }, [seriesList, selectedSerieIds])

  const currentSerie = selectedSeries[0]
  const isMultiSerie = selectedSeries.length > 1

  useEffect(() => {
    if (!incluirMaterial) {
      setSelectedMaterialIds(getDefaultMaterialIdsForSeries(selectedSeries))
    }
  }, [selectedSeries, incluirMaterial])

  const handleToggleSerie = (id: string) => {
    setSelectedSerieIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter(x => x !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const handleSelectAllSeries = () => {
    setSelectedSerieIds(seriesList.map(s => s.id))
  }

  const handleToggleMes = (mes: string) => {
    if (mes === 'Todas') {
      if (selectedMeses.length === 4) {
        setSelectedMeses(['Outubro'])
      } else {
        setSelectedMeses(['Outubro', 'Novembro', 'Dezembro', 'Regular'])
      }
      return
    }

    setSelectedMeses(prev => {
      const order = ['Outubro', 'Novembro', 'Dezembro', 'Regular']
      if (prev.includes(mes)) {
        if (prev.length <= 1) {
          showToast('⚠️ Mantenha ao menos uma etapa selecionada.')
          return prev
        }
        return prev.filter(m => m !== mes)
      } else {
        const next = [...prev, mes]
        return order.filter(m => next.includes(m))
      }
    })
  }

  const currentAntecipacao = useMemo(() => {
    const order = ['Outubro', 'Novembro', 'Dezembro', 'Regular']
    const firstSelected = order.find(m => selectedMeses.includes(m)) || selectedMeses[0] || 'Outubro'
    return ANTECIPACAO_REGRAS.find(r => r.mes === firstSelected) || ANTECIPACAO_REGRAS[0]
  }, [selectedMeses])

  const primeiroMesNome = useMemo(() => {
    return currentAntecipacao.mes === 'Regular' ? 'A partir de Jan' : currentAntecipacao.mes
  }, [currentAntecipacao])

  const fmt = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const calculations = useMemo(() => {
    // Cálculos por série individual
    const seriesCalc = selectedSeries.map(serie => {
      const mensalidadeOrig = serie.mensalidadeBase
      const descMensal = mensalidadeOrig * (descontoPercent / 100)
      const mensalidadeLiq = mensalidadeOrig - descMensal
      const anuidadeOrig = mensalidadeOrig * 12
      const anuidadeLiq = mensalidadeLiq * 12
      const econAnualMensalidades = descMensal * 12

      const matOrig = mensalidadeOrig

      // Matrícula por mês da campanha
      const matCampanha = ANTECIPACAO_REGRAS.filter(r => r.mes !== 'Todas').map(regra => {
        const descAVista = matOrig * (regra.aVistaPct / 100)
        const finalAVista = matOrig - descAVista
        const descParc = matOrig * (regra.parceladoPct / 100)
        const finalParc = matOrig - descParc
        const parcela = numParcelasMatricula > 0 ? (finalParc / numParcelasMatricula) : finalParc
        return {
          mes: regra.mes,
          aVistaPct: regra.aVistaPct,
          parceladoPct: regra.parceladoPct,
          descAVista,
          finalAVista,
          descParc,
          finalParc,
          parcela
        }
      })

      // Regra de referência para o primeiro mês selecionado da campanha
      const regraRef = currentAntecipacao

      const aVistaPct = regraRef.aVistaPct
      const descMatAVista = matOrig * (aVistaPct / 100)
      const finalMatAVista = matOrig - descMatAVista

      const parceladoPct = regraRef.parceladoPct
      const descMatParcelado = matOrig * (parceladoPct / 100)
      const finalMatParcelado = matOrig - descMatParcelado
      const parcelaMat = numParcelasMatricula > 0 ? (finalMatParcelado / numParcelasMatricula) : finalMatParcelado

      let descMatriculaPct = aVistaPct
      let valorDescMatricula = descMatAVista
      let valorMatFinal = finalMatAVista

      if (formaMatricula === 'parcelado') {
        descMatriculaPct = parceladoPct
        valorDescMatricula = descMatParcelado
        valorMatFinal = finalMatParcelado
      }

      const material = incluirMaterial ? (serie.taxaMaterial || 0) : 0

      return {
        serie,
        mensalidadeOrig,
        descMensal,
        mensalidadeLiq,
        anuidadeOrig,
        anuidadeLiq,
        econAnualMensalidades,
        matOrig,
        matCampanha,
        aVistaPct,
        descMatAVista,
        finalMatAVista,
        parceladoPct,
        descMatParcelado,
        finalMatParcelado,
        parcelaMat,
        descMatriculaPct,
        valorDescMatricula,
        valorMatFinal,
        material
      }
    })

    // Totais consolidados
    const mensalidadeOriginal = seriesCalc.reduce((acc, c) => acc + c.mensalidadeOrig, 0)
    const valorDescontoMensal = seriesCalc.reduce((acc, c) => acc + c.descMensal, 0)
    const mensalidadeComDesconto = seriesCalc.reduce((acc, c) => acc + c.mensalidadeLiq, 0)

    const anuidadeOriginal = seriesCalc.reduce((acc, c) => acc + c.anuidadeOrig, 0)
    const anuidadeComDesconto = seriesCalc.reduce((acc, c) => acc + c.anuidadeLiq, 0)
    const economiaAnualMensalidades = seriesCalc.reduce((acc, c) => acc + c.econAnualMensalidades, 0)

    const valorMatriculaOriginal = seriesCalc.reduce((acc, c) => acc + c.matOrig, 0)
    const valorDescontoMatriculaAVista = seriesCalc.reduce((acc, c) => acc + c.descMatAVista, 0)
    const valorMatriculaFinalAVista = seriesCalc.reduce((acc, c) => acc + c.finalMatAVista, 0)

    const valorDescontoMatriculaParcelado = seriesCalc.reduce((acc, c) => acc + c.descMatParcelado, 0)
    const valorMatriculaFinalParcelado = seriesCalc.reduce((acc, c) => acc + c.finalMatParcelado, 0)
    const valorParcelaMatricula = numParcelasMatricula > 0 ? (valorMatriculaFinalParcelado / numParcelasMatricula) : valorMatriculaFinalParcelado

    let descontoMatriculaPct = currentAntecipacao.aVistaPct
    let valorDescontoMatricula = valorDescontoMatriculaAVista
    let valorMatriculaFinal = valorMatriculaFinalAVista

    if (formaMatricula === 'parcelado') {
      descontoMatriculaPct = currentAntecipacao.parceladoPct
      valorDescontoMatricula = valorDescontoMatriculaParcelado
      valorMatriculaFinal = valorMatriculaFinalParcelado
    }

    // Totais por etapa da campanha de antecipação (Outubro, Novembro, Dezembro, Regular)
    const campanhaEtapasTotais = ANTECIPACAO_REGRAS.filter(r => r.mes !== 'Todas').map(regra => {
      const aVistaTot = seriesCalc.reduce((acc, c) => {
        const item = c.matCampanha.find(m => m.mes === regra.mes)
        return acc + (item ? item.finalAVista : 0)
      }, 0)
      const descAVistaTot = seriesCalc.reduce((acc, c) => {
        const item = c.matCampanha.find(m => m.mes === regra.mes)
        return acc + (item ? item.descAVista : 0)
      }, 0)
      const parcTot = seriesCalc.reduce((acc, c) => {
        const item = c.matCampanha.find(m => m.mes === regra.mes)
        return acc + (item ? item.finalParc : 0)
      }, 0)
      const descParcTot = seriesCalc.reduce((acc, c) => {
        const item = c.matCampanha.find(m => m.mes === regra.mes)
        return acc + (item ? item.descParc : 0)
      }, 0)
      const parcelaTot = numParcelasMatricula > 0 ? (parcTot / numParcelasMatricula) : parcTot

      return {
        mes: regra.mes,
        destaque: regra.destaque,
        aVistaPct: regra.aVistaPct,
        parceladoPct: regra.parceladoPct,
        aVistaTot,
        descAVistaTot,
        parcTot,
        descParcTot,
        parcelaTot
      }
    })

    const selectedMats = OPCOES_MATERIAIS.filter(m => selectedMaterialIds.includes(m.id))
    const valorMaterial = incluirMaterial ? selectedMats.reduce((acc, m) => acc + m.valor, 0) : 0
    const valorExtracurricular = 0 // Demonstrativo apenas (R$ 180,00/mês cada avulso, não soma na mensalidade)
    const valorDP = incluirDP ? (numMateriasDP * SERVICOS_ADICIONAIS.dpPorMateria) : 0

    const mensalidadeTotalFinal = mensalidadeComDesconto + valorExtracurricular
    const economiaTotalGeral = economiaAnualMensalidades + valorDescontoMatricula
    const investimentoAnualTotal = anuidadeComDesconto + valorMatriculaFinal + valorMaterial + (valorExtracurricular * 12) + valorDP

    return {
      seriesCalc,
      mensalidadeOriginal,
      valorDescontoMensal,
      mensalidadeComDesconto,
      anuidadeOriginal,
      anuidadeComDesconto,
      economiaAnualMensalidades,
      valorMatriculaOriginal,
      valorDescontoMatriculaAVista,
      valorMatriculaFinalAVista,
      valorDescontoMatriculaParcelado,
      valorMatriculaFinalParcelado,
      valorParcelaMatricula,
      descontoMatriculaPct,
      valorDescontoMatricula,
      valorMatriculaFinal,
      aVistaPct: currentAntecipacao.aVistaPct,
      parceladoPct: currentAntecipacao.parceladoPct,
      valorMaterial,
      selectedMats,
      valorExtracurricular,
      valorDP,
      numMateriasDP,
      mensalidadeTotalFinal,
      economiaTotalGeral,
      investimentoAnualTotal,
      campanhaEtapasTotais
    }
  }, [
    selectedSeries,
    descontoPercent,
    selectedMeses,
    isMultiMeses,
    formaMatricula,
    numParcelasMatricula,
    incluirMaterial,
    selectedMaterialIds,
    incluirExtracurricular,
    selectedAtividadesExtras,
    incluirDP,
    numMateriasDP,
    currentAntecipacao
  ])

  const handleSelectConvenio = (nome: string) => {
    setConvenioSelecionado(nome)
    const conv = CONVENIOS.find(c => c.nome === nome)
    if (conv) setDescontoPercent(conv.desconto)
  }

  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0] || DEFAULT_VALORES_TEMPLATES[0]
  }, [templates, selectedTemplateId])

  const activeMessage = customMsgOverride !== '' ? customMsgOverride : (activeTemplate?.conteudo || '')

  const handleSaveCurrentAsDefault = async () => {
    if (!customMsgOverride.trim()) return
    setIsSavingDb(true)
    try {
      const updated = templates.map(t => {
        if (t.id === selectedTemplateId) {
          return { ...t, conteudo: customMsgOverride }
        }
        return t
      })
      await setDbTemplates(updated)
      setCustomMsgOverride('')
      showToast('✅ Modelo salvo no banco de dados com sucesso!')
    } catch (e) {
      console.error('Erro ao salvar template:', e)
      showToast('❌ Erro ao salvar no banco de dados.')
    } finally {
      setIsSavingDb(false)
    }
  }

  const handleOpenEditorModal = () => {
    setEditingTemplate({ ...activeTemplate })
    setIsEditorModalOpen(true)
  }

  const handleSaveModalTemplate = async () => {
    if (!editingTemplate) return
    setIsSavingDb(true)
    try {
      const exists = templates.some(t => t.id === editingTemplate.id)
      let updated: ValoresWhatsAppTemplate[]
      if (exists) {
        updated = templates.map(t => t.id === editingTemplate.id ? editingTemplate : t)
      } else {
        updated = [...templates, editingTemplate]
      }
      await setDbTemplates(updated)
      setIsEditorModalOpen(false)
      setCustomMsgOverride('')
      showToast('✅ Modelos de WhatsApp salvos no banco de dados!')
    } catch (e) {
      console.error('Erro ao salvar no banco:', e)
      showToast('❌ Erro ao salvar no banco de dados.')
    } finally {
      setIsSavingDb(false)
    }
  }



  const handleRestoreDefaults = async () => {
    if (confirm('Deseja restaurar todos os modelos de mensagem para o padrão original de fábrica?')) {
      setIsSavingDb(true)
      try {
        await setDbTemplates(DEFAULT_VALORES_TEMPLATES)
        setCustomMsgOverride('')
        setIsEditorModalOpen(false)
        showToast('🔄 Modelos restaurados para o padrão original!')
      } catch (e) {
        showToast('❌ Erro ao restaurar modelos.')
      } finally {
        setIsSavingDb(false)
      }
    }
  }

  const handleCreateNewTemplate = () => {
    const newId = `custom-${Date.now()}`
    setEditingTemplate({
      id: newId,
      titulo: 'Novo Modelo',
      conteudo: ''
    })
  }

  const handleDeleteTemplate = async (id: string) => {
    if (templates.length <= 1) {
      showToast('⚠️ É necessário manter pelo menos um modelo de mensagem.')
      return
    }
    const tplToDelete = templates.find(t => t.id === id)
    const tplName = tplToDelete?.titulo || 'este modelo'
    if (!confirm(`Deseja realmente excluir o modelo "${tplName}"? Esta ação não pode ser desfeita.`)) return
    setIsSavingDb(true)
    try {
      const updated = templates.filter(t => t.id !== id)
      await setDbTemplates(updated)
      if (selectedTemplateId === id) {
        setSelectedTemplateId(updated[0]?.id || '')
        setCustomMsgOverride('')
      }
      if (editingTemplate?.id === id) {
        setEditingTemplate(updated[0] ? { ...updated[0] } : null)
      }
      showToast('🗑️ Modelo excluído com sucesso!')
    } catch (e) {
      console.error('Erro ao excluir modelo:', e)
      showToast('❌ Erro ao excluir modelo.')
    } finally {
      setIsSavingDb(false)
    }
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage)
      setCopiedSuccess(true)
      setTimeout(() => setCopiedSuccess(false), 2500)
    } catch (err) {
      console.error('Falha ao copiar:', err)
    }
  }

  const handleOpenWhatsApp = () => {
    try {
      navigator.clipboard.writeText(activeMessage).catch(() => {})
    } catch {}

    const cleanPhone = telefone.replace(/\D/g, '')
    const encoded = encodeURIComponent(activeMessage)
    let url = ''
    if (cleanPhone) {
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
      url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encoded}`
    } else {
      url = `https://api.whatsapp.com/send?text=${encoded}`
    }
    window.open(url, '_blank')
    showToast('Abrindo WhatsApp... 🚀')
  }

  const handlePrint = () => {
    const cardEl = document.getElementById('proposta-card-imprimir')
    if (cardEl) {
      document.body.classList.add('printing-simulador-mode')
      const cardHeight = cardEl.scrollHeight
      const maxSinglePageHeight = 1040 // Altura máxima imprimível em 1 página A4 com margens mínimas
      if (cardHeight > maxSinglePageHeight) {
        const scaleRatio = Math.max(0.60, Math.min(1, maxSinglePageHeight / cardHeight))
        cardEl.style.setProperty('--print-scale', scaleRatio.toFixed(3))
        cardEl.classList.add('force-single-page-print')
      } else {
        cardEl.classList.remove('force-single-page-print')
      }

      window.addEventListener('afterprint', () => {
        document.body.classList.remove('printing-simulador-mode')
        cardEl.classList.remove('force-single-page-print')
      }, { once: true })
    }
    window.print()
  }

  // Gera o arquivo PDF oficial no tamanho EXATO da proposta (Single Page, alta fidelidade e zero sobras em branco)
  // Gera o arquivo PDF oficial no tamanho EXATO da proposta (Single Page, alta fidelidade e zero sobras em branco)
  const generateProposalPdfBlob = async (): Promise<{ blob: Blob; fileName: string; canvas: HTMLCanvasElement }> => {
    if (!propostaCardRef.current) throw new Error('Card da proposta não encontrado')

    const html2canvas = (await import('html2canvas')).default
    const { jsPDF } = await import('jspdf')

    const cardEl = propostaCardRef.current
    const targetWidth = 860

    // Captura com html2canvas em 2.2x Retina com largura generosa de 860px para acomodar todos os badges e colunas
    const canvas = await html2canvas(cardEl, {
      scale: 2.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (el) => el.classList.contains('no-export') || el.classList.contains('no-print'),
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById('proposta-card-imprimir')
        if (el) {
          el.style.width = `${targetWidth}px`
          el.style.maxWidth = `${targetWidth}px`
          el.style.minWidth = `${targetWidth}px`
          el.style.boxShadow = 'none'
          el.style.margin = '0 auto'
          el.style.padding = '0'

          // Remove backdrop-filter e limpa letter-spacing / tabular-nums que causam quebras/espaços em badges e números
          const allNodes = el.querySelectorAll('*')
          allNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              node.style.backdropFilter = 'none'
              ;(node.style as any).webkitBackdropFilter = 'none'
              node.style.letterSpacing = 'normal'
              node.style.fontVariantNumeric = 'normal'
              node.style.fontFeatureSettings = 'normal'
            }
          })

          // Garante que todos os badges no documento clonado acompanhem o texto sem cortes e com centralização impecável
          const allBadges = el.querySelectorAll('.proposta-badge, .badge-auto')
          allBadges.forEach((b) => {
            if (b instanceof HTMLElement) {
              b.style.display = 'inline-flex'
              b.style.alignItems = 'center'
              b.style.justifyContent = 'center'
              b.style.textAlign = 'center'
              b.style.verticalAlign = 'middle'
              b.style.width = 'fit-content'
              b.style.maxWidth = 'max-content'
              b.style.minWidth = '0'
              b.style.whiteSpace = 'nowrap'
              b.style.flexShrink = '0'
              b.style.boxSizing = 'border-box'
              b.style.lineHeight = '1.2'

              // Calcula o border-radius exato (metade da altura real) para evitar o bug de elipse/ovo do html2canvas
              const h = b.offsetHeight || 22
              const cleanRadius = Math.max(6, Math.min(Math.round(h / 2), 14))
              b.style.borderRadius = `${cleanRadius}px`

              // Garante que o texto e ícone internos fiquem perfeitamente centralizados
              Array.from(b.children).forEach((child) => {
                if (child instanceof HTMLElement) {
                  child.style.display = 'inline-flex'
                  child.style.alignItems = 'center'
                  child.style.justifyContent = 'center'
                  child.style.textAlign = 'center'
                  child.style.verticalAlign = 'middle'
                  child.style.lineHeight = '1.2'
                  child.style.whiteSpace = 'nowrap'
                }
              })
            }
          })
        }
      }
    })

    const imgData = canvas.toDataURL('image/png')
    const pdfWidth = targetWidth
    // Altura proporcional exata da proposta — tamanho dinâmico e automático para não sobrar espaço
    const pdfHeight = Math.round((canvas.height / canvas.width) * pdfWidth)

    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [pdfWidth, pdfHeight],
      hotfixes: ['px_scaling']
    })

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')

    const blob = pdf.output('blob')
    const nomeLimpo = (nomeAluno || 'comercial').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const fileName = `proposta-impacto-${nomeLimpo}-${anoLetivo}.pdf`

    return { blob, fileName, canvas }
  }

  // Salvar a proposta em PDF oficial (abre caixa para escolher onde vai salvar e com qual nome)
  const handleSavePDF = async () => {
    if (isGeneratingPdf) return
    setIsGeneratingPdf(true)
    showToast('Gerando PDF oficial da proposta... 📄')

    try {
      const { blob, fileName } = await generateProposalPdfBlob()

      // Tenta abrir a caixa nativa "Salvar como..." para o usuário escolher o local e o nome do arquivo
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'Documento PDF (*.pdf)',
                accept: { 'application/pdf': ['.pdf'] }
              }
            ]
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()

          setPdfSavedSuccess(true)
          setTimeout(() => setPdfSavedSuccess(false), 3500)
          showToast('📄 Proposta salva com sucesso no local e nome escolhidos!')
          return
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') {
            showToast('Operação de salvar PDF cancelada.')
            return
          }
          console.warn('showSaveFilePicker falhou, usando download padrão:', pickerErr)
        }
      }

      // Fallback para navegadores sem showSaveFilePicker
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000)

      setPdfSavedSuccess(true)
      setTimeout(() => setPdfSavedSuccess(false), 3500)
      showToast('📄 PDF gerado e baixado com sucesso!')
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err)
      showToast('Erro ao gerar PDF da proposta. Tente novamente.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // Copiar imagem da proposta para a área de transferência (para colar onde quiser: Ctrl+V / Cmd+V)
  const handleCopyProposal = async () => {
    if (isCopyingProposal) return
    setIsCopyingProposal(true)
    showToast('Copiando proposta para a Área de Transferência... 📋')

    try {
      const { canvas, fileName } = await generateProposalPdfBlob()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Falha ao gerar imagem da proposta')

      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        setProposalCopiedSuccess(true)
        setTimeout(() => setProposalCopiedSuccess(false), 3500)
        showToast('📋 Proposta copiada para a Área de Transferência! Cole onde desejar (Ctrl+V ou Cmd+V).')
      } else {
        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = fileName.replace('.pdf', '.png')
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000)
        showToast('Imagem baixada para colar onde quiser!')
      }
    } catch (err: any) {
      console.error('Erro ao copiar proposta:', err)
      showToast('Não foi possível copiar imagem. Tente salvar em PDF.')
    } finally {
      setIsCopyingProposal(false)
    }
  }


  const filteredSeries = useMemo(() => {
    if (!searchQuery.trim()) return seriesList
    const q = searchQuery.toLowerCase()
    return seriesList.filter(s => 
      s.nome.toLowerCase().includes(q) || 
      s.segmento.toLowerCase().includes(q) ||
      (s.detalhe && s.detalhe.toLowerCase().includes(q))
    )
  }, [seriesList, searchQuery])

  return (
    <div
      className={`matriculas-valores-root ${activeTab === 'simulador' ? 'printing-simulador-mode' : ''}`}
      style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '24px', fontFamily: 'Outfit, system-ui, -apple-system, sans-serif' }}
    >
      {/* Estilos Globais e Específicos para Impressão Perfeita da Proposta Oficial */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm 6mm;
          }

          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Oculta tudo que for navegação, sidebar e botões */
          aside,
          nav,
          header,
          .sidebar,
          [data-sidebar],
          .app-wrapper > aside,
          .main-content > div:first-child,
          .no-print,
          .no-export {
            display: none !important;
          }

          /* Na aba do simulador, oculta o topo, abas, coluna do formulário e card do whatsapp */
          .printing-simulador-mode .valores-header-container,
          .printing-simulador-mode .valores-tabs-container,
          .printing-simulador-mode .valores-form-container,
          .printing-simulador-mode .valores-actions-toolbar,
          .printing-simulador-mode .valores-whatsapp-container {
            display: none !important;
          }

          /* Reset completo dos wrappers para ocupar 100% da folha sem sobras */
          .app-wrapper,
          .main-content,
          .page-content,
          .matriculas-valores-root,
          .matriculas-valores-inner,
          .valores-grid-wrapper,
          .valores-proposal-wrapper {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }

          /* Card Oficial da Proposta Comercial */
          #proposta-card-imprimir {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 14px !important;
            box-shadow: none !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Ajuste automático para caber 100% em 1 PÁGINA sem quebras */
          #proposta-card-imprimir.force-single-page-print {
            zoom: var(--print-scale, 0.85) !important;
          }

          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        /* Padrão Universal de Badges Responsivos e Imutáveis */
        .proposta-badge,
        .badge-auto {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          vertical-align: middle !important;
          gap: 5px !important;
          width: fit-content !important;
          max-width: max-content !important;
          min-width: 0 !important;
          white-space: nowrap !important;
          line-height: 1.2 !important;
          flex-shrink: 0 !important;
          box-sizing: border-box !important;
        }

        .proposta-badge > span,
        .badge-auto > span {
          white-space: nowrap !important;
          line-height: 1.2 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
      `}</style>

      {/* Toast de Notificação */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: 24, right: 24, zIndex: 9999,
              background: '#0f172a', color: '#ffffff', padding: '12px 20px',
              borderRadius: 14, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <Sparkles size={16} color="#10b981" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="matriculas-valores-inner" style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ─── TOPO / CABEÇALHO COM GRADIENTE CLEAN ─── */}
        <div className="valores-header-container no-print" style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #f0fdf4 100%)',
            padding: '24px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <PropostaBadge
                  icon={<Calculator size={13} color="#2563eb" />}
                  bg="#ffffff"
                  border="#bfdbfe"
                  color="#1d4ed8"
                  fontSize={11}
                  fontWeight={800}
                  padding="3px 9px"
                  style={{ boxShadow: '0 1px 3px rgba(37,99,235,0.08)' }}
                >
                  MATRÍCULAS & MENSALIDADES
                </PropostaBadge>

                <PropostaBadge
                  icon={<Sparkles size={13} color="#059669" />}
                  bg="#ffffff"
                  border="#a7f3d0"
                  color="#047857"
                  fontSize={11}
                  fontWeight={800}
                  padding="3px 9px"
                  style={{ boxShadow: '0 1px 3px rgba(5,150,105,0.08)' }}
                >
                  ANO LETIVO {anoLetivo}
                </PropostaBadge>
              </div>

              <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                Tabela de Valores & Simulador Comercial
              </h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Busca de alunos e responsáveis sincronizada com o ERP, cálculo automático de descontos e modelos de WhatsApp personalizáveis salvos no banco.
              </p>
            </div>

            {/* Ações do Topo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', padding: '4px', borderRadius: 12, border: '1px solid #cbd5e1', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {['2027', '2026', '2028'].map(ano => {
                  const isCur = anoLetivo === ano
                  return (
                    <button
                      key={ano}
                      onClick={() => setAnoLetivo(ano)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        background: isCur ? '#2563eb' : 'transparent',
                        color: isCur ? '#ffffff' : '#64748b',
                        boxShadow: isCur ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {ano}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handlePrint}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#ffffff', color: '#334155',
                  border: '1px solid #cbd5e1', borderRadius: 12,
                  padding: '8px 16px', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s'
                }}
              >
                <Printer size={15} color="#64748b" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>

          {/* Abas */}
          <div className="valores-tabs-container no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 28px', background: '#ffffff' }}>
            {[
              { id: 'simulador', label: 'Simulador & WhatsApp', icon: <Sparkles size={16} /> },
              { id: 'tabela-matriculas', label: 'Tabela de Matrículas (Antecipação 2027)', icon: <FileSpreadsheet size={16} /> },
              { id: 'matriz-mensalidades', label: 'Grade de Mensalidades (5% a 15%)', icon: <Percent size={16} /> },
              { id: 'ampliacao-periodo', label: 'Ampliação de Período (2x e 3x)', icon: <Clock size={16} /> },
              { id: 'servicos', label: 'Serviços & Convênios', icon: <Layers size={16} /> },
            ].map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', border: 'none', transition: 'all 0.2s ease',
                    background: isActive ? '#2563eb' : '#f1f5f9',
                    color: isActive ? '#ffffff' : '#475569',
                    boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── ABA 1: SIMULADOR & GERADOR WHATSAPP ─── */}
        {activeTab === 'simulador' && (
          <div className="valores-grid-wrapper" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, alignItems: 'start' }}>
            
            {/* Coluna Esquerda: Formulário do Simulador */}
            <div className="valores-form-container no-print" style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', zIndex: isStudentDropdownOpen ? 40 : 1 }}>
              
              {/* Card 1: Busca & Identificação da Família */}
              <div style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                overflow: 'visible',
                position: 'relative',
                zIndex: isStudentDropdownOpen ? 50 : 2,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
                  padding: '16px 22px',
                  borderBottom: '1px solid #1e293b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTopLeftRadius: 19,
                  borderTopRightRadius: 19
                }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <User size={18} color="#60a5fa" />
                    1. Identificação & Busca no Banco de Alunos
                  </h2>
                  {nomeAluno && (
                    <button
                      onClick={handleClearStudent}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 700, color: '#f87171',
                        background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                      }}
                    >
                      <X size={12} />
                      Limpar Seleção
                    </button>
                  )}
                </div>

                <div style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
                  {/* Campo de Busca Rápida no ERP com Autocomplete */}
                  <div ref={searchContainerRef} style={{ position: 'relative', marginBottom: 16, zIndex: 100 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 6 }}>
                      🔍 Buscar Aluno ou Responsável cadastrado no sistema:
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: 12 }} />
                      <input
                        type="text"
                        placeholder="Digite o nome do aluno ou responsável..."
                        value={studentSearchInput}
                        onChange={e => {
                          setStudentSearchInput(e.target.value)
                          setIsStudentDropdownOpen(true)
                        }}
                        onFocus={() => {
                          if (studentSearchResults.length > 0) setIsStudentDropdownOpen(true)
                        }}
                        style={{
                          width: '100%', padding: '10px 36px 10px 38px', borderRadius: 12,
                          border: '2px solid #93c5fd', background: '#f0f7ff',
                          fontSize: 13, fontWeight: 600, color: '#000000', outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                      {isSearchingStudents ? (
                        <Loader2 size={16} color="#2563eb" className="animate-spin" style={{ position: 'absolute', right: 12, top: 12 }} />
                      ) : studentSearchInput ? (
                        <X size={16} color="#94a3b8" onClick={() => setStudentSearchInput('')} style={{ position: 'absolute', right: 12, top: 12, cursor: 'pointer' }} />
                      ) : null}
                    </div>

                    {/* Dropdown de Resultados da Busca */}
                    {isStudentDropdownOpen && studentSearchResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4,
                        background: '#ffffff', borderRadius: 14, border: '1px solid #cbd5e1',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.22)', maxHeight: 280, overflowY: 'auto'
                      }}>
                        {studentSearchResults.map(res => (
                          <div
                            key={res.id}
                            onClick={() => handleSelectStudent(res)}
                            style={{
                              padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{res.nomeAluno || 'Responsável sem aluno vinculado'}</span>
                              {res.turma && (
                                <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 6 }}>
                                  {res.turma}
                                </span>
                              )}
                            </div>

                            {res.responsaveis.length > 0 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {res.responsaveis.map(resp => (
                                  <span
                                    key={resp.id}
                                    style={{
                                      fontSize: 11, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0',
                                      padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4
                                    }}
                                  >
                                    <strong>{resp.tipo}:</strong> {resp.nome} {resp.telefone ? `(${resp.telefone})` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pílulas de Seleção de Responsáveis Vinculados */}
                  {availableResponsaveis.length > 0 && (
                    <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 6 }}>
                        👥 Responsáveis Vinculados a este Aluno (Clique para selecionar o destinatário):
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {availableResponsaveis.map(resp => {
                          const isSelected = selectedResponsavelId === resp.id || nomeResponsavel.toLowerCase() === resp.nome.toLowerCase()
                          return (
                            <button
                              key={resp.id}
                              onClick={() => handleSelectResponsavelPill(resp)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                                cursor: 'pointer', border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                background: isSelected ? '#2563eb' : '#ffffff',
                                color: isSelected ? '#ffffff' : '#334155',
                                boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <UserCheck size={13} color={isSelected ? '#ffffff' : '#2563eb'} />
                              <span>{resp.tipo}: <strong>{resp.nome}</strong></span>
                              {resp.telefone && <span style={{ opacity: isSelected ? 0.9 : 0.7, fontSize: 10 }}>• {resp.telefone}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Campos de Entrada Editáveis */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Nome do Aluno</label>
                      <input
                        type="text"
                        placeholder="Ex: Gabriel Rossi"
                        value={nomeAluno}
                        onChange={e => setNomeAluno(e.target.value)}
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: 10,
                          border: '1px solid #cbd5e1', background: '#f8fafc',
                          fontSize: 12, color: '#000000', fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Nome do Responsável</label>
                      <input
                        type="text"
                        placeholder="Ex: Patrícia Rossi"
                        value={nomeResponsavel}
                        onChange={e => setNomeResponsavel(e.target.value)}
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: 10,
                          border: '1px solid #cbd5e1', background: '#f8fafc',
                          fontSize: 12, color: '#000000', fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5 }}>WhatsApp / Celular</label>
                      <input
                        type="text"
                        placeholder="(67) 99999-9999"
                        value={telefone}
                        onChange={e => setTelefone(formatPhoneNumber(e.target.value))}
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: 10,
                          border: '1px solid #cbd5e1', background: '#f8fafc',
                          fontSize: 12, color: '#000000', fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Série & Mensalidade */}
              <div style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #2e1065 100%)',
                  padding: '16px 22px',
                  borderBottom: '1px solid #1e1b4b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                      <GraduationCap size={18} color="#a5b4fc" />
                      2. Escolha a Série & Defina o Desconto
                    </h2>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#ffffff',
                      background: selectedSerieIds.length > 1 ? '#2563eb' : 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      padding: '2px 8px',
                      borderRadius: 12
                    }}>
                      {selectedSerieIds.length === 1 ? '1 série' : `${selectedSerieIds.length} séries`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleSelectAllSeries}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#e0e7ff',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Todas as Séries
                    </button>
                    {selectedSerieIds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSerieIds([selectedSerieIds[0]])}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#fca5a5',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Limpar Múltiplas
                      </button>
                    )}
                    <PropostaBadge
                      bg="rgba(255, 255, 255, 0.12)"
                      border="rgba(255, 255, 255, 0.2)"
                      color="#e0e7ff"
                      fontSize={11}
                      fontWeight={800}
                      padding="2.5px 8px"
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                    >
                      Tabela Oficial {anoLetivo}
                    </PropostaBadge>
                  </div>
                </div>

                <div style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
                  {/* Dica de seleção múltipla */}
                  <div style={{
                    fontSize: 11,
                    color: '#475569',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} color="#2563eb" />
                      <strong>Seleção Múltipla Ativa:</strong> Clique nos cards para marcar ou desmarcar mais de uma série.
                    </span>
                    {selectedSerieIds.length > 1 && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#2563eb' }}>
                        Valores individuais e totais incluídos no WhatsApp
                      </span>
                    )}
                  </div>

                  {/* Grade de Séries com Checkbox */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
                    {seriesList.map(serie => {
                      const isSelected = selectedSerieIds.includes(serie.id)
                      return (
                        <div
                          key={serie.id}
                          onClick={() => handleToggleSerie(serie.id)}
                          style={{
                            padding: 12, borderRadius: 12,
                            border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            minHeight: 88,
                            boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.12)' : 'none',
                            transition: 'all 0.15s ease',
                            position: 'relative'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: isSelected ? '#1e3a8a' : '#1e293b' }}>
                                {serie.nome}
                              </span>
                              <div style={{
                                width: 18,
                                height: 18,
                                borderRadius: 6,
                                background: isSelected ? '#2563eb' : '#f8fafc',
                                border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'all 0.15s ease'
                              }}>
                                {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                              </div>
                            </div>
                            {serie.detalhe && (
                              <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 2 }}>{serie.detalhe}</span>
                            )}
                          </div>
                          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>Mensalidade:</span>
                            <span style={{ fontSize: 12, fontWeight: 900, color: isSelected ? '#1d4ed8' : '#2563eb' }}>{fmt(serie.mensalidadeBase)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Seletor de Desconto */}
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Percent size={14} color="#d97706" />
                        Desconto na Mensalidade:
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#000000', background: '#fef3c7', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: 8 }}>
                        {descontoPercent > 0 ? `${descontoPercent}% (-${fmt(calculations.valorDescontoMensal)} / mês)` : '0% (Sem desconto)'}
                      </span>
                    </div>

                    {/* Atalhos */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { label: '0% (Integral)', val: 0 },
                        { label: '5%', val: 5 },
                        { label: '8%', val: 8 },
                        { label: '10%', val: 10 },
                        { label: '11% (Convênio)', val: 11 },
                        { label: '13%', val: 13 },
                        { label: '15% (Máx Padrão)', val: 15 },
                        { label: '20% (Bolsa)', val: 20 },
                      ].map(btn => {
                        const isSel = descontoPercent === btn.val
                        return (
                          <button
                            key={btn.val}
                            onClick={() => {
                              setDescontoPercent(btn.val)
                              if (btn.val !== 11) setConvenioSelecionado('')
                            }}
                            style={{
                              padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                              border: isSel ? '1px solid #d97706' : '1px solid #e2e8f0',
                              background: isSel ? '#d97706' : '#f8fafc',
                              color: isSel ? '#ffffff' : '#475569',
                              cursor: 'pointer', transition: 'all 0.15s'
                            }}
                          >
                            {btn.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Slider com Input Amplo e Nítido */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="0.5"
                        value={descontoPercent}
                        onChange={e => {
                          setDescontoPercent(parseFloat(e.target.value) || 0)
                          setConvenioSelecionado('')
                        }}
                        style={{ flex: 1, accentColor: '#d97706', cursor: 'pointer' }}
                      />
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#ffffff',
                        border: '2px solid #cbd5e1',
                        borderRadius: 10,
                        padding: '6px 12px',
                        gap: 4,
                        minWidth: 80,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={descontoPercent}
                          onChange={e => {
                            const val = e.target.value.replace(',', '.')
                            if (val === '') {
                              setDescontoPercent(0)
                              setConvenioSelecionado('')
                              return
                            }
                            if (/^\d*\.?\d*$/.test(val)) {
                              const num = parseFloat(val)
                              if (!isNaN(num)) {
                                setDescontoPercent(num > 100 ? 100 : num)
                                setConvenioSelecionado('')
                              }
                            }
                          }}
                          style={{
                            width: 50,
                            background: 'transparent',
                            border: 'none',
                            fontSize: 15,
                            fontWeight: 900,
                            color: '#000000',
                            textAlign: 'center',
                            outline: 'none',
                            padding: 0
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#000000' }}>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Campanha de Matrícula Antecipada com Opção "Todas" */}
              <div style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #065f46 100%)',
                  padding: '16px 22px',
                  borderBottom: '1px solid #064e3b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Calendar size={18} color="#6ee7b7" />
                    3. Campanha de Matrícula Antecipada ({anoLetivo})
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isMultiMeses && (
                      <PropostaBadge
                        bg="rgba(255, 255, 255, 0.15)"
                        border="rgba(255, 255, 255, 0.25)"
                        color="#a7f3d0"
                        fontSize={11}
                        fontWeight={800}
                        padding="2.5px 8px"
                      >
                        {isAllMeses ? 'Todas as 4 etapas' : `${selectedMeses.length} etapas selecionadas`}
                      </PropostaBadge>
                    )}
                    <PropostaBadge
                      bg="rgba(255, 255, 255, 0.12)"
                      border="rgba(255, 255, 255, 0.2)"
                      color="#a7f3d0"
                      fontSize={11}
                      fontWeight={800}
                      padding="2.5px 8px"
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                    >
                      Base: 1 Mensalidade
                    </PropostaBadge>
                  </div>
                </div>

                <div style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
                  {/* Meses de Antecipação incluindo o botão TODAS */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                    {ANTECIPACAO_REGRAS.map(regra => {
                      const isTodas = regra.mes === 'Todas'
                      const isSelected = isTodas ? isAllMeses : selectedMeses.includes(regra.mes)
                      return (
                        <div
                          key={regra.mes}
                          onClick={() => handleToggleMes(regra.mes)}
                          style={{
                            padding: 12, borderRadius: 12,
                            border: isSelected
                              ? (isTodas ? '2px solid #8b5cf6' : '2px solid #059669')
                              : (isTodas ? '1px solid #e9d5ff' : '1px solid #e2e8f0'),
                            background: isSelected
                              ? (isTodas ? '#f5f3ff' : '#ecfdf5')
                              : (isTodas ? '#faf5ff' : '#ffffff'),
                            cursor: 'pointer',
                            boxShadow: isSelected
                              ? (isTodas ? '0 2px 10px rgba(139, 92, 246, 0.25)' : '0 2px 8px rgba(5, 150, 105, 0.15)')
                              : 'none',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: isTodas ? '#6b21a8' : '#0f172a' }}>
                              {regra.mes === 'Todas' ? 'Todas' : regra.mes}
                            </span>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: isSelected ? (isTodas ? '#7c3aed' : '#059669') : 'transparent',
                              border: isSelected ? 'none' : '1.5px solid #cbd5e1'
                            }}>
                              {isSelected && (
                                <Check size={12} color="#ffffff" strokeWidth={3} />
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: isTodas ? '#7c3aed' : '#047857', marginTop: 4 }}>
                            {regra.destaque}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{regra.descricao}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Forma de Pagamento */}
                  <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Condição de Pagamento:</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setFormaMatricula('avista')}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
                            background: formaMatricula === 'avista' ? '#059669' : '#ffffff',
                            color: formaMatricula === 'avista' ? '#ffffff' : '#475569',
                            boxShadow: formaMatricula === 'avista' ? '0 2px 6px rgba(5,150,105,0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          À Vista {isMultiMeses ? `(até ${Math.max(...calculations.campanhaEtapasTotais.filter(e => selectedMeses.includes(e.mes)).map(e => e.aVistaPct), 0)}% desc.)` : `(${currentAntecipacao.aVistaPct}% desc.)`}
                        </button>
                        <button
                          onClick={() => setFormaMatricula('parcelado')}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
                            background: formaMatricula === 'parcelado' ? '#059669' : '#ffffff',
                            color: formaMatricula === 'parcelado' ? '#ffffff' : '#475569',
                            boxShadow: formaMatricula === 'parcelado' ? '0 2px 6px rgba(5,150,105,0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Parcelado {isMultiMeses ? `(até ${Math.max(...calculations.campanhaEtapasTotais.filter(e => selectedMeses.includes(e.mes)).map(e => e.parceladoPct), 0)}% desc.)` : `(${currentAntecipacao.parceladoPct}% desc.)`}
                        </button>
                        <button
                          onClick={() => setFormaMatricula('ambos')}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
                            background: formaMatricula === 'ambos' ? 'linear-gradient(135deg, #059669, #2563eb)' : '#ffffff',
                            color: formaMatricula === 'ambos' ? '#ffffff' : '#475569',
                            boxShadow: formaMatricula === 'ambos' ? '0 2px 8px rgba(37,99,235,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Ambos (À Vista + Parcelado)
                        </button>
                      </div>
                    </div>

                    {(formaMatricula === 'parcelado' || formaMatricula === 'ambos') && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 8, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Parcelas do Cartão (em até 5x sem juros):</span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {[1, 2, 3, 4, 5].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setNumParcelasMatricula(p)}
                              style={{
                                width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                background: numParcelasMatricula === p ? '#059669' : '#ffffff',
                                color: numParcelasMatricula === p ? '#ffffff' : '#475569',
                                border: numParcelasMatricula === p ? 'none' : '1px solid #cbd5e1'
                              }}
                            >
                              {p}x
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Valor Calculado - Exibição para Múltiplos Meses ou para Mês Específico */}
                    {isMultiMeses ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: '#f5f3ff',
                          border: '1px solid #ddd6fe'
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={14} /> {isAllMeses ? `Cronograma Completo da Campanha (${anoLetivo}):` : `Etapas Selecionadas (${selectedMeses.length}):`}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>
                            {isAllMeses ? 'Todas as etapas e descontos incluídos no WhatsApp' : formatListWithAnd(selectedMeses)}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                          {calculations.campanhaEtapasTotais.filter(e => selectedMeses.includes(e.mes)).map(etapa => {
                            const isOutubro = etapa.mes === 'Outubro'
                            return (
                              <div
                                key={etapa.mes}
                                style={{
                                  background: '#ffffff',
                                  borderRadius: 10,
                                  padding: '10px 12px',
                                  border: isOutubro ? '1.5px solid #059669' : '1px solid #e2e8f0',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{etapa.mes}</span>
                                  <span style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: isOutubro ? '#047857' : '#475569',
                                    background: isOutubro ? '#ecfdf5' : '#f1f5f9',
                                    padding: '1px 5px',
                                    borderRadius: 4
                                  }}>
                                    {etapa.destaque}
                                  </span>
                                </div>

                                {(formaMatricula === 'avista' || formaMatricula === 'ambos') && (
                                  <div>
                                    <span style={{ fontSize: 9, color: '#64748b', display: 'block' }}>
                                      À Vista {etapa.aVistaPct > 0 ? `(${etapa.aVistaPct}% OFF)` : '(Tabela)'}:
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 900, color: '#047857' }}>
                                      {fmt(etapa.aVistaTot)}
                                    </span>
                                  </div>
                                )}

                                {(formaMatricula === 'parcelado' || formaMatricula === 'ambos') && (
                                  <div>
                                    <span style={{ fontSize: 9, color: '#64748b', display: 'block' }}>
                                      Parcelado {etapa.parceladoPct > 0 ? `(${etapa.parceladoPct}% OFF)` : '(Tabela)'}:
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8' }}>
                                      {numParcelasMatricula}x de {fmt(etapa.parcelaTot)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : formaMatricula === 'ambos' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                        {/* Opção 1: À Vista */}
                        <div style={{ background: '#ffffff', borderRadius: 10, padding: '10px 12px', border: '1px solid #a7f3d0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                            1. À Vista ({calculations.aVistaPct}% OFF):
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#047857' }}>
                            {fmt(calculations.valorMatriculaFinalAVista)}
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            De ~{fmt(calculations.valorMatriculaOriginal)}~ (Economia de {fmt(calculations.valorDescontoMatriculaAVista)})
                          </span>
                        </div>

                        {/* Opção 2: Parcelado */}
                        <div style={{ background: '#ffffff', borderRadius: 10, padding: '10px 12px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                            2. Parcelado ({calculations.parceladoPct}% OFF):
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#1d4ed8' }}>
                            {fmt(calculations.valorMatriculaFinalParcelado)}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>
                            {numParcelasMatricula}x de {fmt(calculations.valorParcelaMatricula)} sem juros
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#ffffff', borderRadius: 10, padding: '10px 14px', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', display: 'block' }}>
                            Matrícula ({formaMatricula === 'avista' ? 'À Vista' : `${numParcelasMatricula}x`}):
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>De ~{fmt(calculations.valorMatriculaOriginal)}~</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#047857', display: 'block' }}>
                            {fmt(calculations.valorMatriculaFinal)}
                          </span>
                          {formaMatricula === 'parcelado' && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                              ({numParcelasMatricula}x de {fmt(calculations.valorParcelaMatricula)})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 4: Serviços Opcionais */}
              <div style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 50%, #4c1d95 100%)',
                  padding: '16px 22px',
                  borderBottom: '1px solid #2e1065',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Layers size={18} color="#c084fc" />
                    4. Serviços Opcionais & Extracurriculares
                  </h2>
                  <PropostaBadge
                    bg="rgba(255, 255, 255, 0.12)"
                    border="rgba(255, 255, 255, 0.2)"
                    color="#e9d5ff"
                    fontSize={11}
                    fontWeight={700}
                    padding="2.5px 8px"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                  >
                    Marque para incluir
                  </PropostaBadge>
                </div>

                <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Material Didático / Livros com Seleção Múltipla */}
                  <div style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: incluirMaterial ? '#faf5ff' : '#f8fafc',
                    border: incluirMaterial ? '1.5px solid #a855f7' : '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    transition: 'all 0.15s ease'
                  }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={incluirMaterial}
                          onChange={e => handleToggleIncluirMaterial(e.target.checked)}
                          style={{ width: 17, height: 17, accentColor: '#7c3aed', cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', display: 'block' }}>
                            Taxa de Material Didático / Livros
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            {incluirMaterial
                              ? `${selectedMaterialIds.length} ${selectedMaterialIds.length === 1 ? 'material selecionado' : 'materiais selecionados'} • Parcelamento em até 5x no cartão`
                              : 'Opcional (anual) • Parcelamento em até 5x no cartão sem juros'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: incluirMaterial ? '#6d28d9' : '#334155', display: 'block' }}>
                          {incluirMaterial && selectedMaterialIds.length > 1
                            ? 'Valores por item (até 5x)'
                            : fmt(calculations.valorMaterial)}
                        </span>
                        <span style={{ fontSize: 9, color: incluirMaterial ? '#7c3aed' : '#94a3b8', fontWeight: 700 }}>
                          {incluirMaterial
                            ? (selectedMaterialIds.length > 1 ? '✓ Demonstrados abaixo com parcelamento' : '✓ Incluído na Proposta (em até 5x)')
                            : 'Opcional (anual)'}
                        </span>
                      </div>
                    </label>

                    {incluirMaterial && (
                      <div style={{
                        borderTop: '1px solid #e9d5ff',
                        paddingTop: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Selecione os materiais (parcelamento em até 5x sem juros):
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMaterialIds(getDefaultMaterialIdsForSeries(selectedSeries))
                              }}
                              style={{
                                background: 'none', border: 'none', fontSize: 10, color: '#7c3aed',
                                fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0
                              }}
                            >
                              Sugerido
                            </button>
                            <span style={{ fontSize: 10, color: '#cbd5e1' }}>•</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMaterialIds(OPCOES_MATERIAIS.map(m => m.id))
                              }}
                              style={{
                                background: 'none', border: 'none', fontSize: 10, color: '#7c3aed',
                                fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0
                              }}
                            >
                              Marcar Todos
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                          {OPCOES_MATERIAIS.map(opcao => {
                            const isSelected = selectedMaterialIds.includes(opcao.id)
                            return (
                              <div
                                key={opcao.id}
                                onClick={() => handleToggleMaterial(opcao.id)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  background: isSelected ? '#f5f3ff' : '#ffffff',
                                  border: isSelected ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}} // Evento tratado pelo card pai
                                    style={{ width: 15, height: 15, accentColor: '#7c3aed', cursor: 'pointer' }}
                                  />
                                  <div>
                                    <span style={{ fontSize: 11, fontWeight: isSelected ? 800 : 700, color: isSelected ? '#581c87' : '#1e293b', display: 'block' }}>
                                      {opcao.nome}
                                    </span>
                                    <span style={{ fontSize: 9.5, color: '#64748b' }}>
                                      {opcao.segmento}
                                    </span>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{
                                    fontSize: 11.5,
                                    fontWeight: 900,
                                    color: isSelected ? '#7c3aed' : '#475569',
                                    background: isSelected ? '#ede9fe' : '#f1f5f9',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    display: 'block'
                                  }}>
                                    {fmt(opcao.valor)}
                                  </span>
                                  <span style={{ fontSize: 9, color: isSelected ? '#6d28d9' : '#64748b', fontWeight: 700 }}>
                                    ou até 5x de {fmt(opcao.valor / 5)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Extracurricular (Apenas Conjunto Informativo • R$ 180,00/mês cada) */}
                  <div style={{
                    padding: '14px 16px', borderRadius: 14,
                    background: incluirExtracurricular ? '#eff6ff' : '#f8fafc',
                    border: incluirExtracurricular ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    transition: 'all 0.15s ease'
                  }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={incluirExtracurricular}
                          onChange={e => handleToggleIncluirExtracurricular(e.target.checked)}
                          style={{ width: 17, height: 17, accentColor: '#2563eb', cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b', display: 'block' }}>
                            Atividades Extracurriculares (2 aulas/sem)
                          </span>
                          <span style={{ fontSize: 10.5, color: '#64748b' }}>
                            Ballet • Jazz • Futsal • Ginástica Rítmica • R$ 180,00/mês cada
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: incluirExtracurricular ? '#2563eb' : '#334155', display: 'block' }}>
                          {`${fmt(SERVICOS_ADICIONAIS.extracurricularMensal)} / mês cada`}
                        </span>
                        <span style={{ fontSize: 9.5, color: incluirExtracurricular ? '#2563eb' : '#94a3b8', fontWeight: 700 }}>
                          {incluirExtracurricular ? '✓ Informado no WhatsApp (R$ 180,00 cada)' : 'Opcional (por modalidade)'}
                        </span>
                      </div>
                    </label>

                    {incluirExtracurricular && (
                      <div style={{
                        borderTop: '1px solid #bfdbfe',
                        paddingTop: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Modalidades inclusas na proposta ({fmt(SERVICOS_ADICIONAIS.extracurricularMensal)}/mês cada):
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: 10 }}>
                            Conjunto Informativo
                          </span>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 8
                        }}>
                          {SERVICOS_ADICIONAIS.atividadesExtracurriculares.map(ativ => (
                            <div
                              key={ativ}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: '#ffffff',
                                border: '1px solid #bfdbfe',
                                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)'
                              }}
                            >
                              <span style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: '#1e40af',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                              }}>
                                <Award size={13} color="#2563eb" />
                                {ativ}
                              </span>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: '#2563eb',
                                background: '#eff6ff',
                                padding: '2px 6px',
                                borderRadius: 6
                              }}>
                                {fmt(SERVICOS_ADICIONAIS.extracurricularMensal)}/mês
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progressão Parcial (DP) */}
                  <div style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: incluirDP ? '#fffbeb' : '#f8fafc',
                    border: incluirDP ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    transition: 'all 0.15s ease'
                  }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={incluirDP}
                          onChange={e => setIncluirDP(e.target.checked)}
                          style={{ width: 17, height: 17, accentColor: '#d97706', cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', display: 'block' }}>Progressão Parcial (DP)</span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            Dependência curricular • {fmt(SERVICOS_ADICIONAIS.dpPorMateria)} por matéria (até 3)
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: incluirDP ? '#d97706' : '#334155', display: 'block' }}>
                          {fmt(SERVICOS_ADICIONAIS.dpPorMateria * numMateriasDP)}
                        </span>
                        <span style={{ fontSize: 9, color: incluirDP ? '#d97706' : '#94a3b8', fontWeight: 700 }}>
                          {incluirDP ? `✓ ${numMateriasDP} ${numMateriasDP > 1 ? 'matérias' : 'matéria'}` : 'R$ 300,00/matéria'}
                        </span>
                      </div>
                    </label>

                    {incluirDP && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fef3c7', paddingTop: 8 }}>
                        <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>Quantidade de matérias em DP:</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {[1, 2, 3].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setNumMateriasDP(n)}
                              style={{
                                padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                background: numMateriasDP === n ? '#d97706' : '#ffffff',
                                color: numMateriasDP === n ? '#ffffff' : '#475569',
                                border: numMateriasDP === n ? 'none' : '1px solid #cbd5e1',
                                boxShadow: numMateriasDP === n ? '0 1px 3px rgba(217,119,6,0.25)' : 'none'
                              }}
                            >
                              {n} {n === 1 ? 'matéria' : 'matérias'} ({fmt(n * SERVICOS_ADICIONAIS.dpPorMateria)})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Coluna Direita: Resumo da Proposta & WhatsApp */}
            <div className="valores-proposal-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Barra de Ações Rápidas da Proposta */}
              <div className="valores-actions-toolbar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color="#2563eb" />
                  Orçamento Comercial • Proposta Oficial
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

                  {/* 2. Salvar Proposta em PDF Oficial (1 página no tamanho exato) */}
                  <button
                    onClick={handleSavePDF}
                    disabled={isGeneratingPdf}
                    title="Salvar proposta comercial em PDF oficial (escolher local e nome)"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: pdfSavedSuccess
                        ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                        : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '7px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
                      boxShadow: pdfSavedSuccess
                        ? '0 2px 8px rgba(5,150,105,0.3)'
                        : '0 2px 8px rgba(37,99,235,0.3)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isGeneratingPdf ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : pdfSavedSuccess ? (
                      <CheckCheck size={15} />
                    ) : (
                      <Download size={15} />
                    )}
                    <span>{isGeneratingPdf ? 'Gerando PDF...' : pdfSavedSuccess ? 'PDF Salvo!' : 'Salvar PDF'}</span>
                  </button>

                  {/* 3. Copiar Imagem da Proposta (Colar onde quiser: Ctrl+V / Cmd+V) */}
                  <button
                    onClick={handleCopyProposal}
                    disabled={isCopyingProposal}
                    title="Copiar proposta para a área de transferência (colar no WhatsApp, Word, etc.)"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: proposalCopiedSuccess
                        ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                        : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '7px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: isCopyingProposal ? 'not-allowed' : 'pointer',
                      boxShadow: proposalCopiedSuccess
                        ? '0 2px 8px rgba(5,150,105,0.3)'
                        : '0 2px 8px rgba(99,102,241,0.3)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isCopyingProposal ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : proposalCopiedSuccess ? (
                      <CheckCheck size={15} />
                    ) : (
                      <Copy size={15} />
                    )}
                    <span>{isCopyingProposal ? 'Copiando...' : proposalCopiedSuccess ? 'Proposta Copiada!' : 'Copiar Proposta'}</span>
                  </button>

                  {/* 4. Imprimir Proposta (Folha A4 Limpa) */}
                  <button
                    onClick={handlePrint}
                    title="Imprimir proposta oficial em folha A4"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: '#ffffff', color: '#334155',
                      border: '1px solid #cbd5e1', borderRadius: 10,
                      padding: '7px 12px', fontSize: 11.5, fontWeight: 700,
                      cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <Printer size={14} />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {/* Card Resumo do Orçamento (Proposta Comercial Oficial) */}
              <div
                ref={propostaCardRef}
                id="proposta-card-imprimir"
                style={{
                  background: '#ffffff',
                  borderRadius: 20,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{
                  background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #60a5fa 100%)',
                  padding: '20px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14
                }}>
                  {/* Lado Esquerdo: Logo + Título + Aluno/Séries */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                    {/* Logo do Colégio Impacto */}
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      background: '#ffffff',
                      padding: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
                      flexShrink: 0
                    }}>
                      <img
                        src="/logo-impacto.png"
                        alt="Colégio Impacto"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#e0f2fe',
                        display: 'block'
                      }}>
                        Colégio Impacto • Orçamento Comercial
                      </span>

                      <h3 style={{ fontSize: 19, fontWeight: 900, color: '#ffffff', margin: '2px 0 0 0', lineHeight: 1.2 }}>
                        {selectedSeries.length === 1 ? currentSerie.nome : `${selectedSeries.length} Opções de Turno`}
                      </h3>

                      {/* Nome do Aluno quando houver */}
                      {nomeAluno.trim() ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 5 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#ffffff',
                            background: 'rgba(255, 255, 255, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            padding: '2px 10px',
                            borderRadius: 20,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            <GraduationCap size={13} color="#ffffff" />
                            Aluno(a): {nomeAluno.trim()}
                          </span>

                          {nomeResponsavel.trim() && (
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: '#eff6ff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <User size={11} color="#bfdbfe" />
                              Resp: {nomeResponsavel.trim()}
                            </span>
                          )}

                          {selectedSeries.length > 1 && (
                            <span style={{ fontSize: 10.5, color: '#dbeafe', fontWeight: 600 }}>
                              • {selectedSeries.map(s => s.nome).join(' • ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        selectedSeries.length > 1 && (
                          <span style={{ fontSize: 11, color: '#e0f2fe', display: 'block', marginTop: 3, fontWeight: 600 }}>
                            {selectedSeries.map(s => s.nome).join(' • ')}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Lado Direito: Badges Oficiais da Proposta */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <PropostaBadge
                      icon={<Sparkles size={12} color="#ffffff" />}
                      bg="rgba(255, 255, 255, 0.20)"
                      border="rgba(255, 255, 255, 0.40)"
                      color="#ffffff"
                      fontSize={11}
                      fontWeight={900}
                      padding="3px 9px"
                      style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.10)' }}
                    >
                      Ano Letivo {anoLetivo}
                    </PropostaBadge>

                    <PropostaBadge
                      icon={<CheckCircle2 size={11} color="#93c5fd" />}
                      bg="rgba(15, 23, 42, 0.25)"
                      border="rgba(255, 255, 255, 0.25)"
                      color="#e0f2fe"
                      fontSize={10}
                      fontWeight={800}
                      padding="3px 9px"
                    >
                      Proposta Oficial
                    </PropostaBadge>
                  </div>
                </div>


                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Métricas Principais (Sem somar mensalidades) */}
                  {selectedSeries.length === 1 ? (
                    <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ padding: '14px 16px', borderRadius: 14, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <DollarSign size={13} color="#2563eb" />
                            Mensalidade {anoLetivo}
                          </span>
                          <span style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8', display: 'block' }}>
                            {fmt(calculations.seriesCalc[0]?.mensalidadeLiq || 0)}
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginLeft: 2 }}>/mês</span>
                          </span>
                        </div>
                        {descontoPercent > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <PropostaBadge
                              bg="#ecfdf5"
                              border="#a7f3d0"
                              color="#059669"
                              fontSize={10}
                              fontWeight={800}
                              padding="3px 8px"
                            >
                              Economia: -{fmt(calculations.seriesCalc[0]?.descMensal || 0)}/mês ({descontoPercent}% OFF)
                            </PropostaBadge>
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '14px 16px', borderRadius: 14, background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#065f46', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <Calendar size={13} color="#059669" />
                            Matrícula ({primeiroMesNome})
                          </span>
                          <span style={{ fontSize: 22, fontWeight: 900, color: '#047857', display: 'block' }}>
                            {fmt(calculations.seriesCalc[0]?.finalMatAVista || 0)}
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginLeft: 4 }}>à vista</span>
                          </span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginTop: 4 }}>
                          ou em até <strong>{numParcelasMatricula}x de {fmt(calculations.seriesCalc[0]?.parcelaMat || 0)}</strong> sem juros
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ padding: '14px 16px', borderRadius: 14, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <Layers size={13} color="#2563eb" />
                            Modalidades Selecionadas
                          </span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: '#1d4ed8', display: 'block' }}>
                            {selectedSeries.length} Opções de Turno
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>
                          Valores individuais detalhados abaixo
                        </span>
                      </div>

                      <div style={{ padding: '14px 16px', borderRadius: 14, background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#065f46', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <Sparkles size={13} color="#059669" />
                            Campanha ({primeiroMesNome})
                          </span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: '#047857', display: 'block' }}>
                            {calculations.aVistaPct > 0 ? `Até ${calculations.aVistaPct}% OFF` : 'Tabela Regular'}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: '#475569', display: 'block', marginTop: 4 }}>
                          Parcelamento em até {numParcelasMatricula}x sem juros
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Detalhamento Individual por Série (NUNCA SOMA MENSALIDADES) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Layers size={14} color="#2563eb" />
                        {selectedSeries.length === 1 ? 'Condições da Série' : `Opções de Valores (${selectedSeries.length} modalidades)`}
                      </span>
                      {descontoPercent > 0 && (
                        <PropostaBadge
                          bg="#ecfdf5"
                          border="#a7f3d0"
                          color="#059669"
                          fontSize={9.5}
                          fontWeight={800}
                          padding="2.5px 8px"
                        >
                          {descontoPercent}% de desconto ativo
                        </PropostaBadge>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {calculations.seriesCalc.map(sc => {
                        const isIntegral = sc.serie.id === 'integral' || sc.serie.nome.toLowerCase().includes('integral')
                        const isIntermediario = sc.serie.id === 'intermediario' || sc.serie.nome.toLowerCase().includes('intermediário') || sc.serie.nome.toLowerCase().includes('intermediario')

                        const theme = isIntegral
                          ? {
                              tag: 'Turno Integral',
                              badgeBg: '#f5f3ff',
                              badgeBorder: '#ddd6fe',
                              accentColor: '#7c3aed',
                              iconBoxBg: '#ede9fe',
                              icon: <Sparkles size={16} color="#7c3aed" />
                            }
                          : isIntermediario
                          ? {
                              tag: 'Turno Intermediário',
                              badgeBg: '#fffbeb',
                              badgeBorder: '#fde68a',
                              accentColor: '#d97706',
                              iconBoxBg: '#fef3c7',
                              icon: <Clock size={16} color="#d97706" />
                            }
                          : {
                              tag: 'Meio Período',
                              badgeBg: '#eff6ff',
                              badgeBorder: '#bfdbfe',
                              accentColor: '#2563eb',
                              iconBoxBg: '#eff6ff',
                              icon: <GraduationCap size={16} color="#2563eb" />
                            }

                        return (
                          <div
                            key={sc.serie.id}
                            className="print-avoid-break"
                            style={{
                              background: '#ffffff',
                              borderRadius: 16,
                              border: '1px solid #e2e8f0',
                              padding: '14px 16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 11,
                              boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)'
                            }}
                          >

                            {/* Cabeçalho Ultra Moderno da Opção */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 10,
                              paddingBottom: 12,
                              borderBottom: '1px solid #f1f5f9'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                                <div style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 10,
                                  background: theme.iconBoxBg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {theme.icon}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                                  <span style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                    {sc.serie.nome}
                                  </span>
                                  <PropostaBadge
                                    bg={theme.badgeBg}
                                    border={theme.badgeBorder}
                                    color={theme.accentColor}
                                    fontSize={10}
                                    fontWeight={800}
                                    padding="3px 9px"
                                  >
                                    {theme.tag.toUpperCase()}
                                  </PropostaBadge>
                                  {sc.serie.detalhe && (
                                    <PropostaBadge
                                      icon={<Utensils size={11} color="#92400e" />}
                                      bg="#fef3c7"
                                      border="#fde68a"
                                      color="#92400e"
                                      fontSize={10}
                                      fontWeight={800}
                                      padding="3px 9px"
                                    >
                                      {sc.serie.detalhe}
                                    </PropostaBadge>
                                  )}
                                </div>
                              </div>

                              {descontoPercent > 0 ? (
                                <PropostaBadge
                                  icon={<Sparkles size={11} color="#059669" />}
                                  bg="linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
                                  border="#a7f3d0"
                                  color="#065f46"
                                  fontSize={10}
                                  fontWeight={800}
                                  padding="3px 9px"
                                  style={{ boxShadow: '0 1px 2px rgba(5, 150, 105, 0.06)' }}
                                >
                                  Economia Anual: <strong style={{ color: '#047857', marginLeft: 3 }}>{fmt(sc.econAnualMensalidades)}</strong>
                                </PropostaBadge>
                              ) : (
                                <PropostaBadge
                                  icon={<ShieldCheck size={11} color="#64748b" />}
                                  bg="#f8fafc"
                                  border="#e2e8f0"
                                  color="#64748b"
                                  fontSize={10}
                                  fontWeight={700}
                                  padding="3px 9px"
                                >
                                  Tabela Padrão
                                </PropostaBadge>
                              )}
                            </div>

                            {/* Mensalidade Escolar */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: descontoPercent > 0
                                ? 'linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%)'
                                : '#f8fafc',
                              padding: '11px 14px',
                              borderRadius: 12,
                              border: descontoPercent > 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                              flexWrap: 'nowrap',
                              gap: 10
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: 9.5,
                                    color: '#64748b',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    <DollarSign size={12} color="#2563eb" />
                                    Investimento Mensal ({anoLetivo}):
                                  </span>
                                  {descontoPercent > 0 && (
                                    <PropostaBadge
                                      bg="#dcfce7"
                                      border="#86efac"
                                      color="#047857"
                                      fontSize={9}
                                      fontWeight={800}
                                      minHeight={20}
                                      padding="2px 7px"
                                    >
                                      {descontoPercent}% OFF
                                    </PropostaBadge>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: 20,
                                    fontWeight: 900,
                                    color: '#1d4ed8',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {fmt(sc.mensalidadeLiq)}
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginLeft: 3 }}>/mês</span>
                                  </span>

                                  {descontoPercent > 0 && (
                                    <span style={{
                                      fontSize: 11,
                                      color: '#94a3b8',
                                      textDecoration: 'line-through',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap'
                                    }}>
                                      Tabela: {fmt(sc.mensalidadeOrig)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {descontoPercent > 0 ? (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: 3,
                                  flexShrink: 0
                                }}>
                                  <PropostaBadge
                                    icon={<Percent size={10} color="#059669" />}
                                    bg="#ecfdf5"
                                    border="#a7f3d0"
                                    color="#065f46"
                                    fontSize={10}
                                    fontWeight={800}
                                    padding="3px 8px"
                                  >
                                    Economia: <strong style={{ color: '#047857', marginLeft: 3 }}>-{fmt(sc.descMensal)}/mês</strong>
                                  </PropostaBadge>
                                  <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    12 parcelas com desconto garantido
                                  </span>
                                </div>
                              ) : (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: 3,
                                  flexShrink: 0
                                }}>
                                  <PropostaBadge
                                    bg="#f1f5f9"
                                    border="#e2e8f0"
                                    color="#64748b"
                                    fontSize={10}
                                    fontWeight={700}
                                    padding="3px 9px"
                                  >
                                    12 parcelas regulares
                                  </PropostaBadge>
                                </div>
                              )}
                            </div>

                            {/* Cronograma de Parcelamento e Matrícula de Todos os Meses */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <Calendar size={12} color="#059669" />
                                  Opções de Matrícula & Parcelamento por Mês:
                                </span>
                                <PropostaBadge
                                  bg="#f0fdf4"
                                  border="#bbf7d0"
                                  color="#065f46"
                                  fontSize={9}
                                  fontWeight={700}
                                  padding="2.5px 7.5px"
                                >
                                  Em até {numParcelasMatricula}x sem juros
                                </PropostaBadge>
                              </div>

                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${sc.matCampanha.length}, minmax(0, 1fr))`,
                              gap: 8
                            }}>
                              {sc.matCampanha.map(m => {
                                const isSelectedMonth = selectedMeses.includes(m.mes)
                                const isRegular = m.mes === 'Regular'
                                const labelMes = isRegular ? 'A partir de Jan' : m.mes
                                const isBestMonth = isSelectedMonth && (m.mes === 'Outubro' || sc.matCampanha.filter(x => selectedMeses.includes(x.mes))[0]?.mes === m.mes)
                                const regraInfo = ANTECIPACAO_REGRAS.find(r => r.mes === m.mes)
                                const tagDestaque = m.aVistaPct > 0 ? (regraInfo?.destaque || `Até ${m.aVistaPct}% OFF`) : 'Tabela Padrão'

                                return (
                                  <div
                                    key={m.mes}
                                    style={{
                                      padding: '9px 10px',
                                      borderRadius: 12,
                                      background: isBestMonth
                                        ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 50%)'
                                        : '#ffffff',
                                      border: isBestMonth
                                        ? '1.5px solid #10b981'
                                        : (isSelectedMonth ? '1px solid #cbd5e1' : '1px solid #f1f5f9'),
                                      boxShadow: isBestMonth
                                        ? '0 3px 8px -2px rgba(16, 185, 129, 0.15)'
                                        : '0 1px 3px rgba(0, 0, 0, 0.02)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: 6,
                                      opacity: isSelectedMonth ? 1 : 0.5,
                                      position: 'relative'
                                    }}
                                  >
                                    {/* Cabeçalho do Mês Sincronizado com o Site */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, minHeight: 22 }}>
                                      <span style={{
                                        fontSize: 10.5,
                                        fontWeight: 900,
                                        color: isBestMonth ? '#065f46' : '#1e293b',
                                        whiteSpace: 'nowrap',
                                        lineHeight: 1.2
                                      }}>
                                        {labelMes}
                                      </span>
                                      <PropostaBadge
                                        bg={m.aVistaPct >= 20 ? '#ecfdf5' : (m.aVistaPct >= 15 ? '#eff6ff' : (m.aVistaPct > 0 ? '#fffbeb' : '#f8fafc'))}
                                        border={m.aVistaPct >= 20 ? '#a7f3d0' : (m.aVistaPct >= 15 ? '#bfdbfe' : (m.aVistaPct > 0 ? '#fde68a' : '#cbd5e1'))}
                                        color={m.aVistaPct >= 20 ? '#047857' : (m.aVistaPct >= 15 ? '#1e40af' : (m.aVistaPct > 0 ? '#92400e' : '#475569'))}
                                        fontSize={7.5}
                                        fontWeight={800}
                                        padding="2px 6px"
                                      >
                                        {tagDestaque}
                                      </PropostaBadge>
                                    </div>

                                    {/* Bloco À Vista */}
                                    <div style={{
                                      background: isBestMonth ? '#ffffff' : '#f8fafc',
                                      padding: '6px 8px',
                                      borderRadius: 8,
                                      border: isBestMonth ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 2
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 7.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                                          À Vista
                                        </span>
                                        <PropostaBadge
                                          bg={m.aVistaPct > 0 ? '#dcfce7' : '#f1f5f9'}
                                          border={m.aVistaPct > 0 ? '#bbf7d0' : '#e2e8f0'}
                                          color={m.aVistaPct > 0 ? '#047857' : '#64748b'}
                                          fontSize={7.5}
                                          fontWeight={m.aVistaPct > 0 ? 800 : 700}
                                          padding="1.5px 5px"
                                          borderRadius={5}
                                        >
                                          {m.aVistaPct > 0 ? `${m.aVistaPct}% desc.` : 'Integral'}
                                        </PropostaBadge>
                                      </div>
                                      <div style={{
                                        fontSize: 13,
                                        fontWeight: 900,
                                        color: isBestMonth ? '#047857' : '#0f172a',
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {fmt(m.finalAVista)}
                                      </div>
                                      <div style={{
                                        fontSize: 7.5,
                                        color: m.descAVista > 0 ? '#059669' : '#94a3b8',
                                        fontWeight: m.descAVista > 0 ? 600 : 500,
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {m.descAVista > 0 ? `Economia: ${fmt(m.descAVista)}` : 'Sem desconto'}
                                      </div>
                                    </div>

                                    {/* Bloco Parcelado */}
                                    <div style={{
                                      background: isBestMonth ? '#ffffff' : '#f8fafc',
                                      padding: '6px 8px',
                                      borderRadius: 8,
                                      border: isBestMonth ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 2
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 7.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                                          Até {numParcelasMatricula}x
                                        </span>
                                        <PropostaBadge
                                          bg={m.parceladoPct > 0 ? '#eff6ff' : '#f1f5f9'}
                                          border={m.parceladoPct > 0 ? '#bfdbfe' : '#e2e8f0'}
                                          color={m.parceladoPct > 0 ? '#1e40af' : '#64748b'}
                                          fontSize={7.5}
                                          fontWeight={m.parceladoPct > 0 ? 800 : 700}
                                          padding="1.5px 5px"
                                          borderRadius={5}
                                        >
                                          {m.parceladoPct > 0 ? `${m.parceladoPct}% desc.` : 'Sem juros'}
                                        </PropostaBadge>
                                      </div>
                                      <div style={{
                                        fontSize: 11.5,
                                        fontWeight: 800,
                                        color: '#1d4ed8',
                                        whiteSpace: 'nowrap',
                                        lineHeight: 1.2
                                      }}>
                                        {numParcelasMatricula}x de {fmt(m.parcela)}
                                      </div>
                                      <div style={{
                                        fontSize: 7.5,
                                        color: '#64748b',
                                        fontWeight: 600,
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap'
                                      }}>
                                        Total: {fmt(m.finalParc)}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    </div>
                  </div>

                  {/* Material Didático (se selecionado) */}
                  {incluirMaterial && selectedMaterialIds.length > 0 && (
                    <div className="print-avoid-break" style={{
                      background: '#faf5ff',
                      borderRadius: 14,
                      border: '1px solid #e9d5ff',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                          <BookOpen size={13} color="#9333ea" />
                          Material Didático e Livros ({selectedMaterialIds.length})
                        </span>
                        <PropostaBadge
                          bg="#f3e8ff"
                          border="#e9d5ff"
                          color="#7e22ce"
                          fontSize={9.5}
                          fontWeight={700}
                          minHeight={22}
                          padding="3px 8px"
                        >
                          Até 5x sem juros
                        </PropostaBadge>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {OPCOES_MATERIAIS.filter(m => selectedMaterialIds.includes(m.id)).map(m => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#581c87', padding: '3px 0', borderBottom: '1px dashed #f3e8ff' }}>
                            <span style={{ fontWeight: 600 }}>• {m.nome}:</span>
                            <span style={{ fontWeight: 800 }}>
                              {fmt(m.valor)} <span style={{ fontSize: 9.5, color: '#7e22ce', fontWeight: 600 }}>(5x de {fmt(m.valor / 5)})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracurriculares (se selecionado) */}
                  {incluirExtracurricular && (
                    <div className="print-avoid-break" style={{
                      background: '#eff6ff',
                      borderRadius: 14,
                      border: '1px solid #bfdbfe',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                          <Award size={13} color="#2563eb" />
                          Atividades Extracurriculares (2 aulas/sem)
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8' }}>
                          {fmt(SERVICOS_ADICIONAIS.extracurricularMensal)}/mês cada
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {SERVICOS_ADICIONAIS.atividadesExtracurriculares.map(at => (
                          <PropostaBadge
                            key={at}
                            bg="#ffffff"
                            border="#bfdbfe"
                            color="#1e40af"
                            fontSize={10}
                            fontWeight={700}
                            minHeight={24}
                            padding="3px 10px"
                          >
                            • {at}
                          </PropostaBadge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progressão Parcial (DP) (se selecionado) */}
                  {incluirDP && (
                    <div className="print-avoid-break" style={{
                      background: '#fffbeb',
                      borderRadius: 12,
                      border: '1px solid #fde68a',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 11,
                      color: '#92400e'
                    }}>
                      <span style={{ fontWeight: 700 }}>
                        Progressão Parcial ({numMateriasDP} {numMateriasDP > 1 ? 'matérias' : 'matéria'}):
                      </span>
                      <span style={{ fontWeight: 900 }}>
                        + {fmt(calculations.valorDP)} (R$ 300,00 cada)
                      </span>
                    </div>
                  )}

                  {/* Banner de Condições e Economia da Campanha */}
                  {(calculations.aVistaPct > 0 || descontoPercent > 0) && (
                    <div className="print-avoid-break" style={{
                      marginTop: 2,
                      padding: '12px 16px',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'nowrap',
                      gap: 12,
                      boxShadow: '0 3px 10px rgba(5, 150, 105, 0.15)'
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={14} color="#6ee7b7" />
                          <span style={{ fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6ee7b7' }}>
                            Condições Especiais • {anoLetivo}
                          </span>
                        </div>

                        <span style={{ fontSize: 11, color: '#e6fffa', display: 'block', marginTop: 2, fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {primeiroMesNome} • Cartão de crédito em até {numParcelasMatricula}x sem juros
                        </span>
                      </div>
                      {calculations.aVistaPct > 0 && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: 9.5, color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                            Matrícula
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>
                            {calculations.aVistaPct}% OFF
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card WhatsApp com Gerenciador de Modelos */}
              <div
                className="valores-whatsapp-container no-print"
                style={{
                  background: '#ffffff',
                  borderRadius: 20,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #047857 100%)',
                  padding: '18px 24px',
                  borderBottom: '1px solid #064e3b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <MessageSquare size={18} color="#34d399" />
                    Gerador de Mensagem WhatsApp
                  </h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={handleOpenEditorModal}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 800, color: '#ffffff',
                        background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)',
                        padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    >
                      <Settings size={13} />
                      Editar Modelos
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#6ee7b7', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '3px 8px', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                      Banco Conectado 🟢
                    </span>
                  </div>
                </div>

                <div style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                  {/* Seletor de Modelos */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {templates.map(tpl => {
                      const isSel = selectedTemplateId === tpl.id
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => {
                            setSelectedTemplateId(tpl.id)
                            setCustomMsgOverride('')
                          }}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
                            background: isSel ? '#10b981' : '#f1f5f9',
                            color: isSel ? '#ffffff' : '#475569',
                            boxShadow: isSel ? '0 2px 6px rgba(16,185,129,0.25)' : 'none',
                            transition: 'all 0.15s'
                          }}
                        >
                          {tpl.titulo}
                        </button>
                      )
                    })}
                  </div>

                  {/* Textarea de Edição Direta */}
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <textarea
                      rows={9}
                      value={activeMessage}
                      onChange={e => setCustomMsgOverride(e.target.value)}
                      style={{
                        width: '100%', padding: 12, borderRadius: 12,
                        border: '1px solid #a7f3d0', background: '#f0fdf4',
                        fontSize: 12, color: '#000000', fontWeight: 500, fontFamily: 'monospace',
                        lineHeight: 1.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                      }}
                    />
                    {customMsgOverride && (
                      <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 6 }}>
                        <button
                          onClick={handleSaveCurrentAsDefault}
                          disabled={isSavingDb}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 800,
                            background: '#047857', color: '#ffffff',
                            border: 'none', borderRadius: 6,
                            padding: '4px 10px', cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(4,120,87,0.3)'
                          }}
                        >
                          {isSavingDb ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Salvar no Banco
                        </button>
                        <button
                          onClick={() => setCustomMsgOverride('')}
                          style={{
                            fontSize: 10, fontWeight: 700,
                            background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6,
                            padding: '4px 8px', cursor: 'pointer', color: '#475569'
                          }}
                        >
                          Descartar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Botões de Ação da Mensagem */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <button
                      onClick={handleCopyText}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, border: '1px solid #cbd5e1',
                        background: copiedSuccess ? '#059669' : '#f8fafc',
                        color: copiedSuccess ? '#ffffff' : '#1e293b',
                        cursor: 'pointer', transition: 'all 0.15s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      {copiedSuccess ? <CheckCheck size={16} /> : <FileText size={16} />}
                      <span>{copiedSuccess ? 'Texto Copiado!' : 'Copiar Texto da Mensagem'}</span>
                    </button>

                    <button
                      onClick={handleOpenWhatsApp}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, border: 'none',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <Send size={16} />
                      <span>{telefone.replace(/\D/g, '') ? 'Conversar com Responsável' : 'Abrir WhatsApp'}</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* ─── ABA 2: TABELA DE MATRÍCULAS 2027 ─── */}
        {activeTab === 'tabela-matriculas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div style={{
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
                padding: '22px 28px',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14
              }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase' }}>Colégio Impacto • {anoLetivo}</span>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: '2px 0 0' }}>Matrículas, Mensalidades e Serviços</h2>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Descontos de antecipação com até 20% de desconto e parcelamento em até 5x sem juros.</p>
                </div>

                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 11 }} />
                  <input
                    type="text"
                    placeholder="Buscar série..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px 8px 30px', borderRadius: 10,
                      border: '1px solid #cbd5e1', background: '#ffffff',
                      fontSize: 12, color: '#000000', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                      <th style={{ padding: '14px 16px' }}>Série / Modalidade</th>
                      <th style={{ padding: '14px 12px', textAlign: 'right' }}>Anuidade (12x)</th>
                      <th style={{ padding: '14px 12px', textAlign: 'right', background: '#eff6ff', color: '#1e40af' }}>Mensalidade {anoLetivo}</th>
                      <th style={{ padding: '14px 12px', textAlign: 'center', background: '#ecfdf5', color: '#065f46', borderLeft: '1px solid #e2e8f0' }}>
                        <div>OUTUBRO</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>20% À Vista | 15% 5x</div>
                      </th>
                      <th style={{ padding: '14px 12px', textAlign: 'center', background: '#eff6ff', color: '#1e40af', borderLeft: '1px solid #e2e8f0' }}>
                        <div>NOVEMBRO</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>15% À Vista | 10% 5x</div>
                      </th>
                      <th style={{ padding: '14px 12px', textAlign: 'center', background: '#fffbeb', color: '#92400e', borderLeft: '1px solid #e2e8f0' }}>
                        <div>DEZEMBRO</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706' }}>10% À Vista | 5% 5x</div>
                      </th>
                      <th style={{ padding: '14px 12px', textAlign: 'center' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSeries.map((serie, idx) => {
                      const base = serie.mensalidadeBase
                      const outAVista = base * 0.80
                      const out5xTotal = base * 0.85
                      const out5xParc = out5xTotal / 5

                      const novAVista = base * 0.85
                      const nov5xTotal = base * 0.90
                      const nov5xParc = nov5xTotal / 5

                      const dezAVista = base * 0.90
                      const dez5xTotal = base * 0.95
                      const dez5xParc = dez5xTotal / 5

                      return (
                        <tr key={serie.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a', display: 'block' }}>{serie.nome}</span>
                            {serie.detalhe && <span style={{ fontSize: 10, color: '#64748b' }}>{serie.detalhe}</span>}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>{fmt(serie.anuidadeBase)}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: '#2563eb', background: 'rgba(239, 246, 255, 0.4)' }}>
                            {fmt(serie.mensalidadeBase)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid #f1f5f9', background: 'rgba(236, 253, 245, 0.4)' }}>
                            <span style={{ fontWeight: 900, color: '#047857', display: 'block' }}>{fmt(outAVista)}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>5x de <strong>{fmt(out5xParc)}</strong></span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid #f1f5f9', background: 'rgba(239, 246, 255, 0.4)' }}>
                            <span style={{ fontWeight: 900, color: '#1d4ed8', display: 'block' }}>{fmt(novAVista)}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>5x de <strong>{fmt(nov5xParc)}</strong></span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid #f1f5f9', background: 'rgba(255, 251, 235, 0.4)' }}>
                            <span style={{ fontWeight: 900, color: '#b45309', display: 'block' }}>{fmt(dezAVista)}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>5x de <strong>{fmt(dez5xParc)}</strong></span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedSerieIds([serie.id])
                                setActiveTab('simulador')
                              }}
                              style={{
                                padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                                border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
                                cursor: 'pointer'
                              }}
                            >
                              Simular
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '14px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b', flexWrap: 'wrap', gap: 10 }}>
                <span><strong>COMO LER A TABELA:</strong> Anuidade = 12 mensalidades. Descontos sobre uma mensalidade, usada como base da matrícula.</span>
                <span>Valores válidos para o Ano Letivo de {anoLetivo}.</span>
              </div>
            </div>

          </div>
        )}

        {/* ─── ABA 3: GRADE DE MENSALIDADES (5% A 15%) ─── */}
        {activeTab === 'matriz-mensalidades' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div style={{
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #451a03 50%, #78350f 100%)',
                padding: '22px 28px',
                borderBottom: '1px solid #451a03',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14
              }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fcd34d', textTransform: 'uppercase' }}>Colégio Impacto • {anoLetivo}</span>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: '2px 0 0' }}>Grade de Mensalidades e Descontos</h2>
                  <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>Valores mensais líquidos por faixa de desconto (5% a 15%).</p>
                </div>

                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 11 }} />
                  <input
                    type="text"
                    placeholder="Buscar série..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px 8px 30px', borderRadius: 10,
                      border: '1px solid #cbd5e1', background: '#ffffff',
                      fontSize: 12, color: '#000000', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                      <th style={{ padding: '14px 16px' }}>Série / Modalidade</th>
                      <th style={{ padding: '14px 12px', textAlign: 'right', background: '#f1f5f9', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>Mensalidade Original</th>
                      {[
                        { pct: 5, label: '5% DESC.' },
                        { pct: 8, label: '8% DESC.' },
                        { pct: 10, label: '10% DESC.' },
                        { pct: 11, label: '11% CONVÊNIO', badge: true },
                        { pct: 13, label: '13% DESC.' },
                        { pct: 15, label: '15% DESC.' },
                      ].map(col => (
                        <th
                          key={col.pct}
                          style={{
                            padding: '14px 12px', textAlign: 'right',
                            background: col.pct === 11 ? '#fff1f2' : 'transparent',
                            color: col.pct === 11 ? '#9f1239' : '#475569',
                            borderLeft: col.pct === 11 ? '1px solid #fecdd3' : 'none',
                            borderRight: col.pct === 11 ? '1px solid #fecdd3' : 'none'
                          }}
                        >
                          <div>{col.label}</div>
                          {col.badge && <span style={{ fontSize: 9, color: '#e11d48' }}>Parceiros</span>}
                        </th>
                      ))}
                      <th style={{ padding: '14px 12px', textAlign: 'center' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSeries.map((serie, idx) => {
                      const base = serie.mensalidadeBase
                      return (
                        <tr key={serie.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a', display: 'block' }}>{serie.nome}</span>
                            {serie.detalhe && <span style={{ fontSize: 10, color: '#64748b' }}>{serie.detalhe}</span>}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: '#0f172a', background: 'rgba(241, 245, 249, 0.6)', borderRight: '1px solid #f1f5f9' }}>
                            {fmt(base)}
                          </td>
                          {[5, 8, 10, 11, 13, 15].map(pct => {
                            const val = base * (1 - (pct / 100))
                            const isConv = pct === 11
                            return (
                              <td
                                key={pct}
                                style={{
                                  padding: '12px', textAlign: 'right', fontWeight: 800,
                                  color: isConv ? '#be123c' : '#334155',
                                  background: isConv ? 'rgba(255, 241, 242, 0.5)' : 'transparent'
                                }}
                              >
                                {fmt(val)}
                              </td>
                            )
                          })}
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedSerieIds([serie.id])
                                setActiveTab('simulador')
                              }}
                              style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                border: '1px solid #fde68a', background: '#fef3c7', color: '#b45309',
                                cursor: 'pointer'
                              }}
                            >
                              Calcular
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '14px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
                Cada percentual é aplicado separadamente sobre a mensalidade original. Valores válidos para pagamento até o vencimento.
              </div>
            </div>

          </div>
        )}

        {/* ─── ABA 4: AMPLIAÇÃO DE PERÍODO (COMPLEMENTO DE TURNO 2X E 3X) ─── */}
        {activeTab === 'ampliacao-periodo' && (
          <AmpliacaoPeriodoTab
            anoLetivo={String(anoLetivo)}
            nomeAluno={nomeAluno}
            nomeResponsavel={nomeResponsavel}
            whatsappCelular={telefone}
          />
        )}

        {/* ─── ABA 5: SERVIÇOS & CONVÊNIOS COM GRADIENTES SUAVES ─── */}
        {activeTab === 'servicos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            
            {/* Card 1: Diárias */}
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)', padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', color: '#60a5fa', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}><Calendar size={18} /></div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0 }}>Diárias Adicionais</h3>
                  <span style={{ fontSize: 11, color: '#93c5fd' }}>Permanência avulsa no contraturno</span>
                </div>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Com Almoço</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#2563eb' }}>R$ 100,00</span>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Sem Almoço</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#475569' }}>R$ 75,00</span>
                </div>
              </div>
            </div>

            {/* Card 2: DP */}
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #451a03 50%, #78350f 100%)', padding: '16px 20px', borderBottom: '1px solid #451a03', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', color: '#fbbf24', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}><BookOpen size={18} /></div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0 }}>Progressão Parcial (DP)</h3>
                  <span style={{ fontSize: 11, color: '#fde68a' }}>Dependência curricular</span>
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ padding: '14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', display: 'block' }}>Taxa por Matéria</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Do 7º ano EF à 2ª série EM (até 3 disciplinas)</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#d97706' }}>
                    R$ 300,00 <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>/ matéria</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Material e Livros Didáticos */}
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 50%, #4c1d95 100%)', padding: '16px 20px', borderBottom: '1px solid #2e1065', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', color: '#c084fc', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}><Layers size={18} /></div>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0 }}>Material Didático & Livros</h3>
                    <span style={{ fontSize: 11, color: '#e9d5ff' }}>Tabela Oficial Anual</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#e9d5ff', background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '2px 8px', borderRadius: 12 }}>
                  Anual
                </span>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SERVICOS_ADICIONAIS.tabelaServicosMateriais.map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', display: 'block' }}>{item.nome}</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>{item.segmento}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#7c3aed' }}>{fmt(item.valor)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 4: Idades */}
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #065f46 100%)', padding: '16px 20px', borderBottom: '1px solid #064e3b', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', color: '#6ee7b7', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}><ShieldCheck size={18} /></div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0 }}>Idades por Nível</h3>
                  <span style={{ fontSize: 11, color: '#a7f3d0' }}>Completos até 31/03/{anoLetivo}</span>
                </div>
              </div>
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {IDADES_POR_NIVEL.map(item => (
                  <div key={item.nivel} style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block' }}>{item.nivel}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#047857' }}>{item.idade}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 5: Convênios */}
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #4c0519 0%, #881337 50%, #9f1239 100%)', padding: '16px 20px', borderBottom: '1px solid #881337', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', color: '#fda4af', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}><HeartHandshake size={18} /></div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0 }}>Descontos por Convênio</h3>
                  <span style={{ fontSize: 11, color: '#fecdd3' }}>11% de desconto na mensalidade</span>
                </div>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Funcionário público',
                  'Sebrae',
                  'Tendência',
                  'Brasil Telecom',
                  'Forças Armadas em geral'
                ].map(conv => (
                  <div key={conv} style={{ padding: '6px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{conv}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#be123c', background: '#ffe4e6', padding: '2px 6px', borderRadius: 4 }}>11%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 6: Extracurriculares */}
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)', padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', color: '#60a5fa', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}><Award size={18} /></div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0 }}>Atividades Extracurriculares</h3>
                  <span style={{ fontSize: 11, color: '#93c5fd' }}>2 aulas por semana</span>
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', display: 'block' }}>Ballet • Jazz • Futsal • Ginástica Rítmica</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Horários no início do ano</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#2563eb' }}>R$ 180,00 <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>/ mês cada</span></span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ─── MODAL DE EDIÇÃO DOS MODELOS DE WHATSAPP (SALVA NO SUPABASE) ─── */}
      <AnimatePresence>
        {isEditorModalOpen && editingTemplate && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 780,
                maxHeight: '90vh', overflowY: 'auto', padding: 28,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', gap: 20
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 8, borderRadius: 10, background: '#eff6ff', color: '#2563eb' }}>
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      Editor de Modelos do WhatsApp
                    </h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                      Personalize os textos oficiais. Todas as alterações serão salvas no banco de dados.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditorModalOpen(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer' }}
                >
                  <X size={18} color="#64748b" />
                </button>
              </div>

              {/* Seletor do Modelo em Edição */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {templates.map(tpl => {
                  const isCurrent = editingTemplate.id === tpl.id
                  return (
                    <div
                      key={tpl.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        borderRadius: 10,
                        border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isCurrent ? '#eff6ff' : '#ffffff',
                        overflow: 'hidden'
                      }}
                    >
                      <button
                        onClick={() => setEditingTemplate({ ...tpl })}
                        style={{
                          padding: '6px 12px', fontSize: 12, fontWeight: 800,
                          border: 'none',
                          background: 'transparent',
                          color: isCurrent ? '#1d4ed8' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        {tpl.titulo}
                      </button>
                      {templates.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteTemplate(tpl.id) }}
                          title={`Excluir modelo "${tpl.titulo}"`}
                          disabled={isSavingDb}
                          style={{
                            padding: '4px 8px', border: 'none',
                            background: 'transparent',
                            color: isCurrent ? '#ef4444' : '#94a3b8',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            borderLeft: '1px solid #e2e8f0',
                            transition: 'color 0.15s'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
                {/* Botão Novo Modelo */}
                <button
                  onClick={handleCreateNewTemplate}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                    border: '2px dashed #10b981',
                    background: '#f0fdf4', color: '#059669',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} />
                  Novo Modelo
                </button>
              </div>

              {/* Título do Modelo */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  Nome / Título do Modelo:
                </label>
                <input
                  type="text"
                  value={editingTemplate.titulo}
                  onChange={e => setEditingTemplate({ ...editingTemplate, titulo: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #cbd5e1', background: '#f8fafc',
                    fontSize: 13, fontWeight: 700, color: '#000000', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Conteúdo do Modelo */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  Corpo da Mensagem (Suporta formatação do WhatsApp como *negrito*, ~tachado~ e emojis):
                </label>
                <textarea
                  ref={templateTextareaRef}
                  rows={12}
                  value={editingTemplate.conteudo}
                  onChange={e => setEditingTemplate({ ...editingTemplate, conteudo: e.target.value })}
                  style={{
                    width: '100%', padding: 14, borderRadius: 12,
                    border: '1px solid #cbd5e1', background: '#ffffff',
                    fontSize: 12, color: '#000000', fontFamily: 'monospace',
                    lineHeight: 1.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Ações do Modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleRestoreDefaults}
                    disabled={isSavingDb}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                      border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={14} />
                    Restaurar Padrões
                  </button>

                  {templates.length > 1 && (
                    <button
                      onClick={() => handleDeleteTemplate(editingTemplate.id)}
                      disabled={isSavingDb}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                        border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} />
                      Excluir Este Modelo
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setIsEditorModalOpen(false)}
                    style={{
                      padding: '10px 18px', borderRadius: 12, fontSize: 12, fontWeight: 800,
                      border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleSaveModalTemplate}
                    disabled={isSavingDb}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '10px 20px', borderRadius: 12, fontSize: 12, fontWeight: 900,
                      border: 'none',
                      background: templates.some(t => t.id === editingTemplate.id) ? '#2563eb' : '#059669',
                      color: '#ffffff',
                      boxShadow: templates.some(t => t.id === editingTemplate.id)
                        ? '0 4px 14px rgba(37, 99, 235, 0.3)'
                        : '0 4px 14px rgba(5, 150, 105, 0.3)',
                      cursor: 'pointer'
                    }}
                  >
                    {isSavingDb ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {templates.some(t => t.id === editingTemplate.id) ? 'Salvar no Banco de Dados' : 'Criar Modelo'}
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
