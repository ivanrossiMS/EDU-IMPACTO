export type FormFieldType =
  | 'texto_curto'
  | 'paragrafo'
  | 'multipla_escolha'
  | 'caixas_selecao'
  | 'lista_suspensa'
  | 'escala_linear'
  | 'nps'
  | 'avaliacao_estrelas'
  | 'termometro_humor'
  | 'grade_multipla'
  | 'grade_caixas'
  | 'ranking'
  | 'usuario_logado'
  | 'data'
  | 'hora'
  | 'numero_moeda'
  | 'sim_nao'
  | 'assinatura_digital'
  | 'bloco_informativo'
  | 'bloco_imagem'

export interface FormMediaItem {
  id: string
  url: string
  caption?: string
  alt?: string
  width?: '25%' | '50%' | '75%' | '100%'
  align?: 'left' | 'center' | 'right'
  position?: 'above' | 'below'
  borderRadius?: number
}

export interface FormFieldValidation {
  regexType?: 'livre' | 'email' | 'cpf' | 'telefone' | 'numero' | 'url'
  minLength?: number
  maxLength?: number
  minValue?: number
  maxValue?: number
  minSelect?: number
  maxSelect?: number
  customErrorText?: string
}

export interface FormConditionalRule {
  enabled: boolean
  sourceFieldId: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
  value: string
}

export interface FormField {
  id: string
  type: FormFieldType
  title: string
  description?: string
  placeholder?: string
  required: boolean
  width?: '100%' | '50%'
  options?: string[]
  optionImages?: Record<number, string>
  media?: FormMediaItem[]
  allowOther?: boolean
  scaleMin?: number
  scaleMax?: number
  scaleMinLabel?: string
  scaleMaxLabel?: string
  starCount?: number
  gridRows?: string[]
  gridCols?: string[]
  numberFormat?: 'decimal' | 'inteiro' | 'moeda_brl' | 'percentual'
  validation?: FormFieldValidation
  conditional?: FormConditionalRule
  quizPoints?: number
  quizCorrectAnswer?: string | string[]
  quizFeedback?: string
  autoFillUser?: 'nome' | 'email' | 'cargo' | 'departamento' | 'none'
  lockAutoFill?: boolean
}

export interface FormSection {
  id: string
  title: string
  description?: string
  media?: FormMediaItem[]
  fields: FormField[]
}

export interface FormThemeConfig {
  presetId: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  cardStyle: 'elevated' | 'bordered' | 'glass' | 'classic_top_bar'
  fontFamily: 'modern' | 'editorial' | 'technical'
  headerStyle: 'gradient' | 'minimal' | 'banner_image'
  headerGradient: string
  headerImageUrl?: string
  headerBannerMode?: 'top_banner' | 'overlay'
  headerBannerHeight?: number
  headerBannerFit?: 'cover' | 'contain'
  headerLogoUrl?: string
  headerTitleColor?: string
  headerSubtitleColor?: string
  headerIcon: string
  displayMode: 'classic_all' | 'section_wizard' | 'focus_one_by_one'
  density: 'comfortable' | 'compact'
  showProgressBar: boolean
  showQuestionNumbers: boolean
}

export interface FormSettingsConfig {
  requireLogin: boolean
  publicLink?: boolean
  allowAccessWithoutModule?: boolean
  allowManualAdminEntry: boolean
  allowMultipleResponses: boolean
  allowEditOwnResponse: boolean
  confidentialMode: boolean
  shuffleQuestions: boolean
  isQuizMode: boolean
  showScoreAtEnd: boolean
  passingScorePercent?: number
  deadline?: string
  targetDepartments?: string[]
  confirmationTitle: string
  confirmationMessage: string
}

export interface GPForm {
  id: string
  title: string
  subtitle?: string
  description?: string
  instructionMedia?: FormMediaItem[]
  category: string
  status: 'ativo' | 'rascunho' | 'encerrado'
  sections: FormSection[]
  theme: FormThemeConfig
  settings: FormSettingsConfig
  createdAt: string
  updatedAt: string
  createdBy: string
  respostasCount?: number
  myResponse?: GPFormResponse | null
}

export interface GPFormResponse {
  id: string
  formId: string
  protocol: string
  respondentId: string
  respondentName: string
  respondentEmail?: string
  respondentRole?: string
  respondentDepartment?: string
  respondentUnit?: string
  source: 'colaborador_logado' | 'inserido_pelo_gestor' | 'importado_planilha' | 'publico_google' | 'link_publico'
  insertedByAdminName?: string
  adminNotes?: string
  answers: Record<string, any>
  quizScore?: {
    earned: number
    total: number
    percent: number
    passed: boolean
  }
  completionTimeSeconds?: number
  submittedAt: string
  updatedAt?: string
  ipAddress?: string
}

export interface ThemePreset {
  id: string
  name: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  headerGradient: string
  cardStyle: FormThemeConfig['cardStyle']
}

export const FORM_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'indigo_impacto',
    name: 'Indigo Impacto (Padrão)',
    primaryColor: '#4f46e5',
    accentColor: '#eef2ff',
    backgroundColor: '#f8fafc',
    headerGradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%)',
    cardStyle: 'classic_top_bar',
  },
  {
    id: 'emerald_rh',
    name: 'Esmeralda Pessoas & Cultura',
    primaryColor: '#059669',
    accentColor: '#ecfdf5',
    backgroundColor: '#f0fdf4',
    headerGradient: 'linear-gradient(135deg, #064e3b 0%, #059669 55%, #10b981 100%)',
    cardStyle: 'elevated',
  },
  {
    id: 'sky_modern',
    name: 'Oceano Corporativo',
    primaryColor: '#0284c7',
    accentColor: '#e0f2fe',
    backgroundColor: '#f0f9ff',
    headerGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 55%, #38bdf8 100%)',
    cardStyle: 'elevated',
  },
  {
    id: 'royal_purple',
    name: 'Violeta Inovação',
    primaryColor: '#7c3aed',
    accentColor: '#f5f3ff',
    backgroundColor: '#faf5ff',
    headerGradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #a855f7 100%)',
    cardStyle: 'glass',
  },
  {
    id: 'rose_care',
    name: 'Acolhimento & Bem-Estar',
    primaryColor: '#e11d48',
    accentColor: '#fff1f2',
    backgroundColor: '#fff5f7',
    headerGradient: 'linear-gradient(135deg, #881337 0%, #e11d48 55%, #fb7185 100%)',
    cardStyle: 'elevated',
  },
  {
    id: 'amber_energy',
    name: 'Âmbar Liderança',
    primaryColor: '#d97706',
    accentColor: '#fffbeb',
    backgroundColor: '#fefce8',
    headerGradient: 'linear-gradient(135deg, #78350f 0%, #d97706 55%, #f59e0b 100%)',
    cardStyle: 'classic_top_bar',
  },
  {
    id: 'slate_executive',
    name: 'Executivo Minimalista',
    primaryColor: '#0f172a',
    accentColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    headerGradient: 'linear-gradient(135deg, #020617 0%, #1e293b 60%, #334155 100%)',
    cardStyle: 'bordered',
  },
]

export const HEADER_BANNER_PRESETS: { id: string; label: string; url: string }[] = [
  {
    id: 'banner_clima',
    label: 'Clima & Engajamento (Ondas Indigo)',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="50%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="1200" height="320" fill="url(#g)"/><circle cx="1050" cy="60" r="180" fill="rgba(255,255,255,0.08)"/><circle cx="180" cy="280" r="220" fill="rgba(255,255,255,0.06)"/><path d="M0,220 C320,300 480,120 820,210 C1020,260 1120,180 1200,200 L1200,320 L0,320 Z" fill="rgba(255,255,255,0.12)"/></svg>`
    )}`,
  },
  {
    id: 'banner_pessoas',
    label: 'Cultura & Pessoas (Esmeralda)',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#064e3b"/><stop offset="55%" stop-color="#059669"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs><rect width="1200" height="320" fill="url(#g2)"/><circle cx="950" cy="160" r="240" fill="rgba(255,255,255,0.08)"/><circle cx="250" cy="70" r="140" fill="rgba(255,255,255,0.07)"/><path d="M0,250 Q400,150 800,250 T1200,210 L1200,320 L0,320 Z" fill="rgba(255,255,255,0.12)"/></svg>`
    )}`,
  },
  {
    id: 'banner_treinamento',
    label: 'Educação & Capacitação (Geométrico)',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="50%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs><rect width="1200" height="320" fill="url(#g3)"/><polygon points="900,0 1200,0 1200,320 750,320" fill="rgba(255,255,255,0.06)"/><polygon points="1020,0 1200,0 1200,320 880,320" fill="rgba(255,255,255,0.08)"/><circle cx="140" cy="160" r="190" fill="rgba(56,189,248,0.15)"/></svg>`
    )}`,
  },
  {
    id: 'banner_sst',
    label: 'Saúde, Bem-Estar & SST (Acolhimento)',
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4c1d95"/><stop offset="55%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><rect width="1200" height="320" fill="url(#g4)"/><circle cx="1020" cy="110" r="170" fill="rgba(255,255,255,0.09)"/><path d="M0,210 C280,290 620,120 1200,240 L1200,320 L0,320 Z" fill="rgba(255,255,255,0.11)"/></svg>`
    )}`,
  },
]

export const FORM_CATEGORIES = [
  'Avaliação de Desempenho',
  'Clima & Engajamento',
  'Onboarding & Experiência',
  'Treinamento & Quiz',
  'Solicitações ao RH',
  'Saúde & Segurança (SST)',
  'Pesquisa Interna',
  'Entrevista de Desligamento',
  'Outros',
]

export const DEFAULT_THEME_CONFIG: FormThemeConfig = {
  presetId: 'indigo_impacto',
  primaryColor: '#4f46e5',
  accentColor: '#eef2ff',
  backgroundColor: '#f8fafc',
  cardStyle: 'classic_top_bar',
  fontFamily: 'modern',
  headerStyle: 'gradient',
  headerGradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%)',
  headerTitleColor: '#ffffff',
  headerSubtitleColor: '#ffffff',
  headerIcon: 'ClipboardList',
  displayMode: 'classic_all',
  density: 'comfortable',
  showProgressBar: true,
  showQuestionNumbers: true,
}

export const DEFAULT_SETTINGS_CONFIG: FormSettingsConfig = {
  requireLogin: true,
  publicLink: false,
  allowAccessWithoutModule: false,
  allowManualAdminEntry: true,
  allowMultipleResponses: false,
  allowEditOwnResponse: true,
  confidentialMode: false,
  shuffleQuestions: false,
  isQuizMode: false,
  showScoreAtEnd: false,
  passingScorePercent: 70,
  confirmationTitle: 'Resposta registrada com sucesso!',
  confirmationMessage:
    'Agradecemos sua participação. Suas informações foram salvas com segurança na central de Gestão de Pessoas.',
}

export const MOOD_OPTIONS = [
  { value: '1', emoji: '😠', label: 'Muito Insatisfeito', color: '#ef4444' },
  { value: '2', emoji: '😟', label: 'Insatisfeito', color: '#f97316' },
  { value: '3', emoji: '😐', label: 'Neutro / Regular', color: '#eab308' },
  { value: '4', emoji: '😊', label: 'Satisfeito', color: '#22c55e' },
  { value: '5', emoji: '🤩', label: 'Excelente / Encantado', color: '#10b981' },
]

export const SEED_GP_FORMS: GPForm[] = [
  {
    id: 'form-avaliacao-experiencia-90d',
    title: 'Avaliação de Integração e Período de Experiência (45 / 90 Dias)',
    subtitle: 'Acompanhamento de Onboarding, Adaptação Cultural e Suporte da Liderança',
    description:
      'Este formulário tem como objetivo ouvir sua percepção sobre a recepção, treinamento inicial, clareza das atividades e estrutura de trabalho no Colégio Impacto.',
    category: 'Onboarding & Experiência',
    status: 'ativo',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-15T14:30:00.000Z',
    createdBy: 'Gestão de Pessoas',
    theme: {
      ...DEFAULT_THEME_CONFIG,
      presetId: 'indigo_impacto',
      primaryColor: '#4f46e5',
      accentColor: '#eef2ff',
      headerGradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%)',
      headerIcon: 'Sparkles',
    },
    settings: {
      ...DEFAULT_SETTINGS_CONFIG,
      requireLogin: true,
      allowManualAdminEntry: true,
      allowMultipleResponses: false,
      allowEditOwnResponse: true,
    },
    sections: [
      {
        id: 'sec-1',
        title: '1. Percepção Geral e Onboarding',
        description: 'Avalie como foi sua chegada e integração com a equipe.',
        fields: [
          {
            id: 'f-ciclo',
            type: 'multipla_escolha',
            title: 'Em qual momento do período de experiência você se encontra?',
            required: true,
            width: '50%',
            options: [
              '1º Ciclo (Até 45 dias)',
              '2º Ciclo (46 a 90 dias)',
              'Acompanhamento Pós-Experiência (Mais de 90 dias)',
            ],
          },
          {
            id: 'f-humor',
            type: 'termometro_humor',
            title: 'Como você se sente hoje trabalhando em nossa instituição?',
            required: true,
            width: '50%',
          },
          {
            id: 'f-grade-integracao',
            type: 'grade_multipla',
            title: 'Avalie os seguintes aspectos da sua integração e rotina de trabalho:',
            description: 'Selecione uma opção para cada linha.',
            required: true,
            width: '100%',
            gridRows: [
              'Recepção e acolhimento pela equipe',
              'Clareza sobre minhas metas e responsabilidades',
              'Suporte e disponibilidade do gestor imediato',
              'Recursos, materiais e infraestrutura de trabalho',
              'Alinhamento com a cultura e valores da escola',
            ],
            gridCols: ['Insuficiente', 'Regular', 'Bom', 'Muito Bom', 'Excelente'],
          },
          {
            id: 'f-treinamento-extra',
            type: 'sim_nao',
            title: 'Você sente necessidade de algum treinamento complementar para exercer melhor sua função?',
            required: true,
            width: '100%',
          },
          {
            id: 'f-qual-treinamento',
            type: 'texto_curto',
            title: 'Qual tema ou ferramenta você gostaria de aprofundar no treinamento?',
            description: 'Exibido porque você respondeu "Sim" na pergunta anterior.',
            placeholder: 'Ex: Sistema acadêmico, gestão de sala de aula, atendimento...',
            required: true,
            width: '100%',
            conditional: {
              enabled: true,
              sourceFieldId: 'f-treinamento-extra',
              operator: 'equals',
              value: 'Sim',
            },
          },
          {
            id: 'f-nps',
            type: 'nps',
            title: 'De 0 a 10, o quanto você recomendaria o Colégio Impacto como um excelente lugar para trabalhar?',
            required: true,
            width: '100%',
          },
          {
            id: 'f-sugestoes',
            type: 'paragrafo',
            title: 'Deixe seus comentários, elogios ou sugestões de melhoria para a Gestão de Pessoas:',
            placeholder: 'Escreva livremente sua percepção...',
            required: false,
            width: '100%',
          },
        ],
      },
    ],
  },
  {
    id: 'form-levantamento-desenvolvimento-rh',
    title: 'Mapeamento de Competências, Benefícios e PDI 2026',
    subtitle: 'Plano de Desenvolvimento Individual e Prioridades da Equipe',
    description:
      'Ajude o RH a planejar os próximos treinamentos, workshops e melhorias nos programas de qualidade de vida dos colaboradores.',
    category: 'Treinamento & Quiz',
    status: 'ativo',
    createdAt: '2026-10-10T09:00:00.000Z',
    updatedAt: '2026-10-20T11:20:00.000Z',
    createdBy: 'Gestão de Pessoas',
    theme: {
      ...DEFAULT_THEME_CONFIG,
      presetId: 'emerald_rh',
      primaryColor: '#059669',
      accentColor: '#ecfdf5',
      backgroundColor: '#f0fdf4',
      headerGradient: 'linear-gradient(135deg, #064e3b 0%, #059669 55%, #10b981 100%)',
      headerIcon: 'Award',
    },
    settings: {
      ...DEFAULT_SETTINGS_CONFIG,
      requireLogin: true,
      allowManualAdminEntry: true,
      allowMultipleResponses: true,
    },
    sections: [
      {
        id: 'sec-pdi-1',
        title: 'Interesses de Capacitação e Carreira',
        fields: [
          {
            id: 'f-temas-interesse',
            type: 'caixas_selecao',
            title: 'Quais áreas de desenvolvimento mais interessam você neste semestre?',
            description: 'Você pode selecionar várias opções ou adicionar outra.',
            required: true,
            width: '100%',
            allowOther: true,
            options: [
              'Comunicação Não-Violenta e Feedback',
              'Liderança e Gestão de Pessoas',
              'Tecnologia Educacional e Inteligência Artificial',
              'Saúde Emocional e Gestão do Tempo',
              'Atendimento de Excelência às Famílias',
              'Primeiros Socorros e Segurança Escolar (SST)',
            ],
          },
          {
            id: 'f-ranking-formato',
            type: 'ranking',
            title: 'Ordene por sua preferência os formatos de treinamento (1º = Mais preferido):',
            description: 'Use as setas para subir ou descer cada item na ordem de sua preferência.',
            required: true,
            width: '100%',
            options: [
              'Workshops práticos presenciais',
              'Cursos rápidos online (Microlearning)',
              'Mentoria individual com liderança',
              'Rodas de conversa e troca de experiências',
            ],
          },
          {
            id: 'f-satisfacao-aprendizado',
            type: 'avaliacao_estrelas',
            title: 'Como você avalia as oportunidades de aprendizado que teve nos últimos 6 meses?',
            required: true,
            width: '50%',
            starCount: 5,
          },
          {
            id: 'f-turno-preferencia',
            type: 'lista_suspensa',
            title: 'Melhor período para participar de capacitações:',
            required: true,
            width: '50%',
            options: [
              'Manhã (08h às 11h)',
              'Tarde (14h às 17h)',
              'Noite (18h30 às 21h)',
              'Sábado pela manhã',
              '100% Assíncrono (Online no meu ritmo)',
            ],
          },
          {
            id: 'f-meta-carreira',
            type: 'paragrafo',
            title: 'Qual é o seu principal objetivo de desenvolvimento profissional para os próximos 12 meses?',
            placeholder: 'Compartilhe suas metas e como o RH pode apoiar você...',
            required: false,
            width: '100%',
          },
        ],
      },
    ],
  },
]

export interface FormTemplateBlueprint {
  id: string
  name: string
  description: string
  category: string
  iconName: string
  color: string
  form: Omit<GPForm, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
}

export const FORM_TEMPLATE_BLUEPRINTS: FormTemplateBlueprint[] = [
  {
    id: 'tpl-blank',
    name: 'Formulário em Branco',
    description: 'Comece do zero com total liberdade para adicionar seções, campos, lógica condicional e layout.',
    category: 'Personalizado',
    iconName: 'Plus',
    color: '#4f46e5',
    form: {
      title: 'Formulário sem título',
      subtitle: '',
      description: '',
      category: 'Pesquisa Interna',
      status: 'ativo',
      theme: { ...DEFAULT_THEME_CONFIG },
      settings: { ...DEFAULT_SETTINGS_CONFIG },
      sections: [
        {
          id: 'sec-1',
          title: 'Seção Principal',
          description: '',
          fields: [
            {
              id: 'q-1',
              type: 'multipla_escolha',
              title: 'Pergunta sem título',
              required: true,
              width: '100%',
              options: ['Opção 1', 'Opção 2', 'Opção 3'],
              allowOther: false,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'tpl-experiencia',
    name: 'Avaliação de Experiência (45/90 dias)',
    description: 'Avalie a adaptação, acolhimento, clareza de função e suporte do gestor para novos colaboradores.',
    category: 'Onboarding & Experiência',
    iconName: 'UserCheck',
    color: '#4f46e5',
    form: {
      title: SEED_GP_FORMS[0].title,
      subtitle: SEED_GP_FORMS[0].subtitle,
      description: SEED_GP_FORMS[0].description,
      category: SEED_GP_FORMS[0].category,
      status: 'ativo',
      theme: { ...SEED_GP_FORMS[0].theme },
      settings: { ...SEED_GP_FORMS[0].settings },
      sections: SEED_GP_FORMS[0].sections,
    },
  },
  {
    id: 'tpl-clima-360',
    name: 'Pesquisa de Clima & Satisfação 360°',
    description: 'Diagnóstico completo com eNPS, matriz de avaliação de liderança, infraestrutura e sugestões.',
    category: 'Clima & Engajamento',
    iconName: 'HeartHandshake',
    color: '#059669',
    form: {
      title: 'Pesquisa de Clima e Engajamento Institucional',
      subtitle: 'Sua voz transforma nosso ambiente de trabalho',
      description: 'Responda com sinceridade para construirmos ações práticas de valorização e bem-estar.',
      category: 'Clima & Engajamento',
      status: 'ativo',
      theme: {
        ...DEFAULT_THEME_CONFIG,
        presetId: 'emerald_rh',
        primaryColor: '#059669',
        accentColor: '#ecfdf5',
        backgroundColor: '#f0fdf4',
        headerGradient: 'linear-gradient(135deg, #064e3b 0%, #059669 55%, #10b981 100%)',
      },
      settings: { ...DEFAULT_SETTINGS_CONFIG },
      sections: [
        {
          id: 'sec-clima-1',
          title: 'Ambiente, Liderança e Reconhecimento',
          fields: [
            {
              id: 'c-1',
              type: 'termometro_humor',
              title: 'Qual sentimento melhor resume sua última semana de trabalho?',
              required: true,
              width: '100%',
            },
            {
              id: 'c-2',
              type: 'grade_multipla',
              title: 'Avalie seu grau de concordância com as afirmações abaixo:',
              required: true,
              width: '100%',
              gridRows: [
                'Sinto que meu trabalho é valorizado e reconhecido',
                'A comunicação interna entre setores é clara e eficiente',
                'Tenho equilíbrio saudável entre vida pessoal e profissional',
                'Recebo feedbacks construtivos para evoluir na carreira',
              ],
              gridCols: ['Discordo Totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo Totalmente'],
            },
            {
              id: 'c-3',
              type: 'nps',
              title: 'Em uma escala de 0 a 10, qual a probabilidade de você recomendar nossa instituição para um amigo trabalhar?',
              required: true,
              width: '100%',
            },
            {
              id: 'c-4',
              type: 'paragrafo',
              title: 'O que podemos fazer nos próximos 30 dias para tornar seu dia a dia de trabalho melhor?',
              required: false,
              width: '100%',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'tpl-quiz-treinamento',
    name: 'Avaliação de Treinamento + Teste de Conhecimento (Quiz)',
    description: 'Inclui correção automática com pontuação para validar o aprendizado de treinamentos e NR-01.',
    category: 'Treinamento & Quiz',
    iconName: 'GraduationCap',
    color: '#7c3aed',
    form: {
      title: 'Avaliação de Eficácia e Teste de Treinamento Interno',
      subtitle: 'Validação de aprendizado e feedback da capacitação',
      description: 'Preencha as questões abaixo para concluir sua participação e emitir seu registro de presença.',
      category: 'Treinamento & Quiz',
      status: 'ativo',
      theme: {
        ...DEFAULT_THEME_CONFIG,
        presetId: 'royal_purple',
        primaryColor: '#7c3aed',
        accentColor: '#f5f3ff',
        backgroundColor: '#faf5ff',
        headerGradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #a855f7 100%)',
      },
      settings: {
        ...DEFAULT_SETTINGS_CONFIG,
        isQuizMode: true,
        showScoreAtEnd: true,
        passingScorePercent: 70,
      },
      sections: [
        {
          id: 'sec-quiz-1',
          title: 'Questões Avaliativas e Feedback',
          fields: [
            {
              id: 'qz-1',
              type: 'multipla_escolha',
              title: 'Qual é o canal oficial para registro seguro de ocorrências de ética ou conformidade na instituição?',
              required: true,
              width: '100%',
              options: [
                'Grupo informal de mensagens',
                'Canal de Ética e Denúncias no Módulo Gestão de Pessoas',
                'Apenas reunião anual',
                'Não existe canal específico',
              ],
              quizPoints: 50,
              quizCorrectAnswer: 'Canal de Ética e Denúncias no Módulo Gestão de Pessoas',
              quizFeedback: 'O Canal de Denúncias em Gestão de Pessoas garante sigilo e rastreabilidade por protocolo.',
            },
            {
              id: 'qz-2',
              type: 'multipla_escolha',
              title: 'Sobre o acolhimento e segurança no trabalho (SST / NR-01), é dever de todo colaborador:',
              required: true,
              width: '100%',
              options: [
                'Comunicar situações de risco e participar das orientações preventivas',
                'Ignorar pequenos incidentes',
                'Deixar a prevenção exclusivamente para a diretoria',
              ],
              quizPoints: 50,
              quizCorrectAnswer: 'Comunicar situações de risco e participar das orientações preventivas',
            },
            {
              id: 'qz-3',
              type: 'avaliacao_estrelas',
              title: 'Qual sua nota geral para a didática e conteúdo deste treinamento?',
              required: true,
              width: '100%',
              starCount: 5,
            },
            {
              id: 'qz-4',
              type: 'assinatura_digital',
              title: 'Assinatura de Confirmação de Participação no Treinamento:',
              description: 'Assine no quadro abaixo com o mouse ou dedo.',
              required: true,
              width: '100%',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'tpl-solicitacao-rh',
    name: 'Requerimento / Solicitação Interna ao RH',
    description: 'Formulário formal com assinatura digital para solicitação de declarações, benefícios, férias ou alteração cadastral.',
    category: 'Solicitações ao RH',
    iconName: 'FileCheck2',
    color: '#0284c7',
    form: {
      title: 'Requerimento Digital ao Departamento de Gestão de Pessoas',
      subtitle: 'Solicitação formal com protocolo e assinatura eletrônica',
      description: 'Utilize este formulário para registrar pedidos de declarações, férias, atualização de dados ou benefícios.',
      category: 'Solicitações ao RH',
      status: 'ativo',
      theme: {
        ...DEFAULT_THEME_CONFIG,
        presetId: 'sky_modern',
        primaryColor: '#0284c7',
        accentColor: '#e0f2fe',
        backgroundColor: '#f0f9ff',
        headerGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 55%, #38bdf8 100%)',
      },
      settings: {
        ...DEFAULT_SETTINGS_CONFIG,
        allowMultipleResponses: true,
      },
      sections: [
        {
          id: 'sec-req-1',
          title: 'Dados da Solicitação',
          fields: [
            {
              id: 'req-tipo',
              type: 'lista_suspensa',
              title: 'Tipo de Solicitação:',
              required: true,
              width: '50%',
              options: [
                'Declaração de Vínculo / Trabalho',
                'Programação de Férias / Recesso',
                'Atualização de Dados Bancários ou Endereço',
                'Inclusão/Alteração de Benefícios',
                'Justificativa de Ponto / Atestado',
                'Outros Requerimentos',
              ],
            },
            {
              id: 'req-data',
              type: 'data',
              title: 'Data de Referência / Vigência Desejada:',
              required: true,
              width: '50%',
            },
            {
              id: 'req-detalhes',
              type: 'paragrafo',
              title: 'Descreva detalhadamente sua solicitação:',
              placeholder: 'Informe os detalhes necessários para atendimento pelo RH...',
              required: true,
              width: '100%',
            },
            {
              id: 'req-assinatura',
              type: 'assinatura_digital',
              title: 'Assinatura Digital do Colaborador:',
              required: true,
              width: '100%',
            },
          ],
        },
      ],
    },
  },
]
