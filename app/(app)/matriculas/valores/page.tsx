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
  Users, UserCheck, Settings, Save, Edit3, Plus, Trash2, CheckSquare
} from 'lucide-react'
import { useConfigDb } from '@/lib/useConfigDb'

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
    id: 'completo',
    titulo: 'Proposta Completa',
    descricao: 'Orçamento detalhado com mensalidade, matrícula, economia anual e adicionais.',
    conteudo: `🏫 *COLÉGIO IMPACTO – ANO LETIVO {ano_letivo}*
📋 *Proposta de Matrícula & Valores*

{saudacao}
Conforme conversamos, segue o orçamento detalhado{ref_aluno}:

📚 *Série/Modalidade:* *{serie}* {detalhe_serie}

💰 *MENSALIDADE:*
• Valor original de tabela: ~{mensalidade_tabela}~
• *Mensalidade com desconto ({desconto_pct}%):* *{mensalidade_liquida}* / mês
✨ *Economia anual na mensalidade:* {economia_anual}

🎁 *CONDIÇÃO ESPECIAL DE MATRÍCULA ({mes_antecipacao}):*
{detalhe_matricula}
*(Economia de {economia_matricula} na matrícula)*

{linha_material}
{linha_extracurricular}

🌟 *Economia Total para {ano_letivo}:* *{economia_total}*

Para garantir esta condição e reservar a vaga, estamos à disposição para agendar uma visita e formalizar a matrícula!

📍 *Colégio Impacto* – Educação que transforma!`
  },
  {
    id: 'antecipacao',
    titulo: 'Antecipação',
    descricao: 'Foco na campanha de matrículas antecipadas com descontos exclusivos.',
    conteudo: `🚀 *CAMPANHA DE ANTECIPAÇÃO {ano_letivo} – COLÉGIO IMPACTO*

{saudacao}
Aproveite a melhor condição de matrícula do ano{ref_aluno}!

🎯 *Modalidade:* *{serie}*
📅 *Condição de {mes_antecipacao}:*

1️⃣ *Matrícula com {desconto_matricula_pct}% OFF:*
👉 {detalhe_matricula}

2️⃣ *Mensalidade com {desconto_pct}% de desconto:*
👉 *{mensalidade_liquida}* / mês

💡 *Economia garantida:* *{economia_total}* no ano!

⚠️ *Atenção:* Vagas limitadas por turma com essa tabela promocional.
Posso já preparar o seu link de matrícula ou agendamos um horário hoje?`
  },
  {
    id: 'convenio',
    titulo: 'Convênio',
    descricao: 'Mensagem com ênfase no convênio e parceria institucional.',
    conteudo: `🤝 *CONVÊNIO ESPECIAL PARCEIRO – COLÉGIO IMPACTO {ano_letivo}*

{saudacao}
Temos uma condição exclusiva pelo convênio *{convenio}*{ref_aluno}:

🎓 *Série:* *{serie}*
🏷️ *Desconto de Convênio:* *{desconto_pct}%*
💵 *Mensalidade de:* ~{mensalidade_tabela}~
➡️ *Por apenas:* *{mensalidade_liquida}* mensais

📝 *Matrícula com Desconto de Antecipação ({mes_antecipacao}):*
{detalhe_matricula}

Será uma honra ter a sua família conosco neste ano letivo! Como prefere dar início ao cadastro?`
  },
  {
    id: 'direto',
    titulo: 'Curto e Direto',
    descricao: 'Mensagem objetiva e rápida para envio ágil.',
    conteudo: `Olá{nome_destinatario}! Seguem os valores do *Colégio Impacto* para *{serie}* ({ano_letivo}){ref_aluno}:

• *Mensalidade:* *{mensalidade_liquida}* (com {desconto_pct}% desc.)
• *Matrícula ({mes_antecipacao}):* {detalhe_matricula}
• *Economia total:* *{economia_total}*

Qualquer dúvida estou à disposição para ajudar com a documentação!`
  }
]

const TEMPLATE_VARIABLES = [
  { tag: '{saudacao}', desc: 'Saudação (ex: Olá, Patrícia! Tudo bem?)' },
  { tag: '{ref_aluno}', desc: 'Texto para o aluno (ex: para o(a) aluno(a) Gabriel)' },
  { tag: '{nome_destinatario}', desc: 'Nome do responsável' },
  { tag: '{serie}', desc: 'Nome da série (ex: Integral)' },
  { tag: '{detalhe_serie}', desc: 'Detalhe da série (ex: Almoço incluído)' },
  { tag: '{ano_letivo}', desc: 'Ano letivo (ex: 2027)' },
  { tag: '{mensalidade_tabela}', desc: 'Mensalidade original (ex: R$ 2.195,00)' },
  { tag: '{desconto_pct}', desc: '% de desconto (ex: 10)' },
  { tag: '{mensalidade_liquida}', desc: 'Mensalidade com desconto (ex: R$ 1.975,50)' },
  { tag: '{economia_anual}', desc: 'Economia nas 12 mensalidades' },
  { tag: '{mes_antecipacao}', desc: 'Mês de antecipação (ex: Outubro)' },
  { tag: '{desconto_matricula_pct}', desc: '% de desconto da matrícula' },
  { tag: '{detalhe_matricula}', desc: 'Texto da condição à vista ou parcelada' },
  { tag: '{economia_matricula}', desc: 'Valor economizado na matrícula' },
  { tag: '{linha_material}', desc: 'Linha do material didático (se ativo)' },
  { tag: '{linha_extracurricular}', desc: 'Linha da extracurricular (se ativo)' },
  { tag: '{economia_total}', desc: 'Economia total (mensalidades + matrícula)' },
  { tag: '{convenio}', desc: 'Nome do convênio parceiro selecionado' },
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
    taxaMaterialDesc: 'Taxa anual de material'
  },
  {
    id: 'intermediario',
    nome: 'Intermediário',
    detalhe: 'Almoço incluído',
    segmento: 'Período Estendido',
    mensalidadeBase: 1895.00,
    anuidadeBase: 22740.00,
    taxaMaterial: 480.00,
    taxaMaterialDesc: 'Taxa anual de material'
  },
  {
    id: 'villa-baby',
    nome: 'Villa Baby',
    detalhe: 'N1 e N2',
    segmento: 'Villa Baby',
    mensalidadeBase: 1395.00,
    anuidadeBase: 16740.00,
    taxaMaterial: 480.00,
    taxaMaterialDesc: 'Taxa de material (N1) R$ 480 / N2 Livros R$ 600'
  },
  {
    id: 'ed-infantil',
    nome: 'Educação Infantil',
    detalhe: 'N3, N4 e N5',
    segmento: 'Educação Infantil',
    mensalidadeBase: 1230.00,
    anuidadeBase: 14760.00,
    taxaMaterial: 1285.00,
    taxaMaterialDesc: 'Livros (anual) + Socioemocional'
  },
  {
    id: 'fund-1',
    nome: 'Fundamental I',
    detalhe: '1º ao 5º ano',
    segmento: 'Fundamental I',
    mensalidadeBase: 1230.00,
    anuidadeBase: 14760.00,
    taxaMaterial: 1350.00,
    taxaMaterialDesc: 'Sistema Didático / Livros anuais'
  },
  {
    id: 'fund-2',
    nome: 'Fundamental II',
    detalhe: '6º ao 9º ano',
    segmento: 'Fundamental II',
    mensalidadeBase: 1330.00,
    anuidadeBase: 15960.00,
    taxaMaterial: 1480.00,
    taxaMaterialDesc: 'Sistema Didático / Livros anuais'
  },
  {
    id: 'em-1',
    nome: 'Ensino Médio 1ª série',
    detalhe: '1ª série',
    segmento: 'Ensino Médio',
    mensalidadeBase: 1495.00,
    anuidadeBase: 17940.00,
    taxaMaterial: 1620.00,
    taxaMaterialDesc: 'Material Didático Novo Ensino Médio'
  },
  {
    id: 'em-2',
    nome: 'Ensino Médio 2ª série',
    detalhe: '2ª série',
    segmento: 'Ensino Médio',
    mensalidadeBase: 1545.00,
    anuidadeBase: 18540.00,
    taxaMaterial: 1620.00,
    taxaMaterialDesc: 'Material Didático Novo Ensino Médio'
  },
  {
    id: 'em-3',
    nome: 'Ensino Médio 3ª série',
    detalhe: '3ª série (Terceirão / Pré-Vestibular)',
    segmento: 'Ensino Médio',
    mensalidadeBase: 1625.00,
    anuidadeBase: 19500.00,
    taxaMaterial: 1750.00,
    taxaMaterialDesc: 'Material Didático Enem / Pré-Vestibular'
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
  }
]

const SERVICOS_ADICIONAIS = {
  diariaComAlmoco: 100.00,
  diariaSemAlmoco: 75.00,
  dpPorMateria: 300.00,
  taxaMaterialBabyN1: 480.00,
  extracurricularMensal: 180.00,
  atividadesExtracurriculares: ['Ballet', 'Jazz', 'Futsal', 'Ginástica Rítmica']
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
  if (t.includes('baby') || t.includes('berçario') || t.includes('bercario') || t.includes('n1') || t.includes('n2') || t.includes('berçário')) return 'villa-baby'
  if (t.includes('infantil') || t.includes('n3') || t.includes('n4') || t.includes('n5')) return 'ed-infantil'
  if (t.includes('1º ano') || t.includes('2º ano') || t.includes('3º ano') || t.includes('4º ano') || t.includes('5º ano') || t.includes('fund 1') || t.includes('fundamental 1') || t.includes('fundamental i')) return 'fund-1'
  if (t.includes('6º') || t.includes('7º') || t.includes('8º') || t.includes('9º') || t.includes('fund 2') || t.includes('fundamental 2') || t.includes('fundamental ii')) return 'fund-2'
  if (t.includes('1ª série') || t.includes('1a serie') || t.includes('1º em') || t.includes('1º médio') || t.includes('1ª serie')) return 'em-1'
  if (t.includes('2ª série') || t.includes('2a serie') || t.includes('2º em') || t.includes('2º médio') || t.includes('2ª serie')) return 'em-2'
  if (t.includes('3ª série') || t.includes('3a serie') || t.includes('terceir') || t.includes('3º em') || t.includes('3º médio') || t.includes('3ª serie') || t.includes('vestibular')) return 'em-3'
  return null
}

export default function ValoresPage() {
  const [activeTab, setActiveTab] = useState<'simulador' | 'tabela-matriculas' | 'matriz-mensalidades' | 'servicos'>('simulador')
  const [anoLetivo, setAnoLetivo] = useState<string>('2027')
  const [seriesList] = useState<SeriePricing[]>(DEFAULT_SERIES_2027)

  // Sincronização e Persistência no Banco de Dados (Supabase) via useConfigDb
  const { data: dbTemplates = [], setData: setDbTemplates, loading: loadingTemplates } = useConfigDb<ValoresWhatsAppTemplate>('cfgWhatsAppValores', DEFAULT_VALORES_TEMPLATES)
  const templates = dbTemplates.length > 0 ? dbTemplates : DEFAULT_VALORES_TEMPLATES

  // Estados do Simulador
  const [selectedSerieId, setSelectedSerieId] = useState<string>('integral')
  const [descontoPercent, setDescontoPercent] = useState<number>(10)
  const [convenioSelecionado, setConvenioSelecionado] = useState<string>('')
  const [mesAntecipacao, setMesAntecipacao] = useState<string>('Outubro')
  const [formaMatricula, setFormaMatricula] = useState<'avista' | 'parcelado' | 'ambos'>('avista')
  const [numParcelasMatricula, setNumParcelasMatricula] = useState<number>(5)

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

  // Opcionais
  const [incluirMaterial, setIncluirMaterial] = useState<boolean>(false)
  const [incluirExtracurricular, setIncluirExtracurricular] = useState<boolean>(false)
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<string>('Futsal')

  // Modelo de WhatsApp Selecionado
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('completo')
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
            combined.push({
              id: `aluno-${a.id}`,
              rawId: String(a.id),
              nomeAluno: a.nome || '',
              turma: a.turma || a.serie || '',
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
                const existing = combined.find(c => c.nomeAluno.toLowerCase() === (a.nome || '').toLowerCase())
                if (existing) {
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
                    turma: a.turma || a.serie || '',
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
    if (detectedSerie) setSelectedSerieId(detectedSerie)

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
  }

  const currentSerie = useMemo(() => {
    return seriesList.find(s => s.id === selectedSerieId) || seriesList[0]
  }, [seriesList, selectedSerieId])

  const currentAntecipacao = useMemo(() => {
    return ANTECIPACAO_REGRAS.find(r => r.mes === mesAntecipacao) || ANTECIPACAO_REGRAS[0]
  }, [mesAntecipacao])

  const calculations = useMemo(() => {
    const mensalidadeOriginal = currentSerie.mensalidadeBase
    const valorDescontoMensal = mensalidadeOriginal * (descontoPercent / 100)
    const mensalidadeComDesconto = mensalidadeOriginal - valorDescontoMensal

    const anuidadeOriginal = mensalidadeOriginal * 12
    const anuidadeComDesconto = mensalidadeComDesconto * 12
    const economiaAnualMensalidades = valorDescontoMensal * 12

    const valorMatriculaOriginal = mensalidadeOriginal

    // Condição À Vista
    const aVistaPct = currentAntecipacao.aVistaPct
    const valorDescontoMatriculaAVista = valorMatriculaOriginal * (aVistaPct / 100)
    const valorMatriculaFinalAVista = valorMatriculaOriginal - valorDescontoMatriculaAVista

    // Condição Parcelada
    const parceladoPct = currentAntecipacao.parceladoPct
    const valorDescontoMatriculaParcelado = valorMatriculaOriginal * (parceladoPct / 100)
    const valorMatriculaFinalParcelado = valorMatriculaOriginal - valorDescontoMatriculaParcelado
    const valorParcelaMatricula = numParcelasMatricula > 0 ? (valorMatriculaFinalParcelado / numParcelasMatricula) : valorMatriculaFinalParcelado

    let descontoMatriculaPct = aVistaPct
    let valorDescontoMatricula = valorDescontoMatriculaAVista
    let valorMatriculaFinal = valorMatriculaFinalAVista

    if (formaMatricula === 'parcelado') {
      descontoMatriculaPct = parceladoPct
      valorDescontoMatricula = valorDescontoMatriculaParcelado
      valorMatriculaFinal = valorMatriculaFinalParcelado
    } else if (formaMatricula === 'ambos') {
      descontoMatriculaPct = aVistaPct
      valorDescontoMatricula = valorDescontoMatriculaAVista
      valorMatriculaFinal = valorMatriculaFinalAVista
    }

    const valorMaterial = incluirMaterial ? (currentSerie.taxaMaterial || 0) : 0
    const valorExtracurricular = incluirExtracurricular ? SERVICOS_ADICIONAIS.extracurricularMensal : 0

    const mensalidadeTotalFinal = mensalidadeComDesconto + valorExtracurricular
    const economiaTotalGeral = economiaAnualMensalidades + valorDescontoMatricula
    const investimentoAnualTotal = anuidadeComDesconto + valorMatriculaFinal + valorMaterial + (valorExtracurricular * 12)

    return {
      mensalidadeOriginal,
      valorDescontoMensal,
      mensalidadeComDesconto,
      anuidadeOriginal,
      anuidadeComDesconto,
      economiaAnualMensalidades,
      descontoMatriculaPct,
      valorMatriculaOriginal,
      valorDescontoMatricula,
      valorMatriculaFinal,
      valorParcelaMatricula,
      aVistaPct,
      valorDescontoMatriculaAVista,
      valorMatriculaFinalAVista,
      parceladoPct,
      valorDescontoMatriculaParcelado,
      valorMatriculaFinalParcelado,
      valorMaterial,
      valorExtracurricular,
      mensalidadeTotalFinal,
      economiaTotalGeral,
      investimentoAnualTotal
    }
  }, [
    currentSerie,
    descontoPercent,
    mesAntecipacao,
    formaMatricula,
    numParcelasMatricula,
    incluirMaterial,
    incluirExtracurricular,
    currentAntecipacao
  ])

  const fmt = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const handleSelectConvenio = (nome: string) => {
    setConvenioSelecionado(nome)
    const conv = CONVENIOS.find(c => c.nome === nome)
    if (conv) setDescontoPercent(conv.desconto)
  }

  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0] || DEFAULT_VALORES_TEMPLATES[0]
  }, [templates, selectedTemplateId])

  const generatedWhatsAppMsg = useMemo(() => {
    const saudacao = nomeResponsavel.trim() ? `Olá, *${nomeResponsavel.trim()}*! Tudo bem?` : `Olá! Tudo bem?`
    const refAluno = nomeAluno.trim() ? ` para o(a) aluno(a) *${nomeAluno.trim()}*` : ''
    const nomeDest = nomeResponsavel.trim() ? ` ${nomeResponsavel.trim()}` : ''

    let detalheMatricula = ''
    if (formaMatricula === 'ambos') {
      detalheMatricula = `• *Opção 1 (À VISTA - ${calculations.aVistaPct}% OFF):* *${fmt(calculations.valorMatriculaFinalAVista)}* _(Economia de ${fmt(calculations.valorDescontoMatriculaAVista)})_\n• *Opção 2 (PARCELADO em até ${numParcelasMatricula}x - ${calculations.parceladoPct}% OFF):* Total de *${fmt(calculations.valorMatriculaFinalParcelado)}* em *${numParcelasMatricula}x de ${fmt(calculations.valorParcelaMatricula)}*`
    } else if (formaMatricula === 'avista') {
      detalheMatricula = `• *À VISTA (${calculations.descontoMatriculaPct}% de desconto):* *${fmt(calculations.valorMatriculaFinal)}*`
    } else {
      detalheMatricula = `• *PARCELADO EM ATÉ ${numParcelasMatricula}x (${calculations.descontoMatriculaPct}% de desconto):* Total de *${fmt(calculations.valorMatriculaFinal)}* em *${numParcelasMatricula}x de ${fmt(calculations.valorParcelaMatricula)}*`
    }

    const descontoMatriculaPctDesc = formaMatricula === 'ambos'
      ? `${calculations.aVistaPct}% (à vista) / ${calculations.parceladoPct}% (parcelado)`
      : String(calculations.descontoMatriculaPct)

    const economiaMatriculaDesc = formaMatricula === 'ambos'
      ? `até ${fmt(calculations.valorDescontoMatriculaAVista)}`
      : fmt(calculations.valorDescontoMatricula)

    const linhaMaterial = incluirMaterial ? `📦 *Material Didático:* ${fmt(calculations.valorMaterial)} (anual)` : ''
    const linhaExtracurricular = incluirExtracurricular ? `⚽ *Atividade Extracurricular (${atividadeSelecionada}):* ${fmt(calculations.valorExtracurricular)} / mês (2 aulas por semana)` : ''

    let content = activeTemplate.conteudo

    const replacements: Record<string, string> = {
      saudacao,
      ref_aluno: refAluno,
      nome_destinatario: nomeDest,
      serie: currentSerie.nome,
      detalhe_serie: currentSerie.detalhe ? `(${currentSerie.detalhe})` : '',
      ano_letivo: anoLetivo,
      mensalidade_tabela: fmt(calculations.mensalidadeOriginal),
      desconto_pct: String(descontoPercent),
      mensalidade_liquida: fmt(calculations.mensalidadeComDesconto),
      economia_anual: fmt(calculations.economiaAnualMensalidades),
      mes_antecipacao: mesAntecipacao.toUpperCase(),
      desconto_matricula_pct: descontoMatriculaPctDesc,
      detalhe_matricula: detalheMatricula,
      economia_matricula: economiaMatriculaDesc,
      linha_material: linhaMaterial,
      linha_extracurricular: linhaExtracurricular,
      economia_total: fmt(calculations.economiaTotalGeral),
      convenio: convenioSelecionado || 'Institucional'
    }

    for (const [k, v] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{${k}\\}`, 'g')
      content = content.replace(regex, v)
    }

    return content.replace(/\n\n\n+/g, '\n\n').trim()
  }, [
    activeTemplate,
    anoLetivo,
    nomeResponsavel,
    nomeAluno,
    currentSerie,
    descontoPercent,
    calculations,
    mesAntecipacao,
    formaMatricula,
    numParcelasMatricula,
    incluirMaterial,
    incluirExtracurricular,
    atividadeSelecionada,
    convenioSelecionado
  ])

  const activeMessage = customMsgOverride || generatedWhatsAppMsg

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

  const handleInsertTag = (tag: string) => {
    if (!templateTextareaRef.current || !editingTemplate) return
    const el = templateTextareaRef.current
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const text = editingTemplate.conteudo
    const newText = text.substring(0, start) + tag + text.substring(end)
    setEditingTemplate({ ...editingTemplate, conteudo: newText })
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    }, 50)
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
    const isDefault = DEFAULT_VALORES_TEMPLATES.some(t => t.id === id)
    if (isDefault) {
      showToast('⚠️ Modelos padrão não podem ser excluídos. Use "Restaurar Padrões" para redefini-los.')
      return
    }
    if (!confirm('Deseja excluir este modelo? Esta ação não pode ser desfeita.')) return
    setIsSavingDb(true)
    try {
      const updated = templates.filter(t => t.id !== id)
      await setDbTemplates(updated)
      // Se o modelo excluído estava sendo editado, seleciona o primeiro disponível
      if (editingTemplate?.id === id) {
        setEditingTemplate(updated[0] ? { ...updated[0] } : null)
      }
      showToast('🗑️ Modelo excluído com sucesso!')
    } catch (e) {
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
    const cleanPhone = telefone.replace(/\D/g, '')
    const encoded = encodeURIComponent(activeMessage)
    const url = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
  }

  const handlePrint = () => {
    window.print()
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
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '24px', fontFamily: 'Outfit, system-ui, -apple-system, sans-serif' }}>
      
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

      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ─── TOPO / CABEÇALHO COM GRADIENTE CLEAN ─── */}
        <div style={{
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  background: '#ffffff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 1px 3px rgba(37,99,235,0.08)'
                }}>
                  <Calculator size={13} color="#2563eb" />
                  MATRÍCULAS & MENSALIDADES
                </span>

                <span style={{
                  background: '#ffffff',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 1px 3px rgba(5,150,105,0.08)'
                }}>
                  <Sparkles size={13} color="#059669" />
                  ANO LETIVO {anoLetivo}
                </span>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 28px', background: '#ffffff' }}>
            {[
              { id: 'simulador', label: 'Simulador & WhatsApp', icon: <Sparkles size={16} /> },
              { id: 'tabela-matriculas', label: 'Tabela de Matrículas (Antecipação 2027)', icon: <FileSpreadsheet size={16} /> },
              { id: 'matriz-mensalidades', label: 'Grade de Mensalidades (5% a 15%)', icon: <Percent size={16} /> },
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, alignItems: 'start' }}>
            
            {/* Coluna Esquerda: Formulário do Simulador */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Card 1: Busca & Identificação da Família */}
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
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
                  padding: '16px 22px',
                  borderBottom: '1px solid #1e293b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
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
                  <div ref={searchContainerRef} style={{ position: 'relative', marginBottom: 16 }}>
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
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                        background: '#ffffff', borderRadius: 14, border: '1px solid #cbd5e1',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxHeight: 280, overflowY: 'auto'
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
                  alignItems: 'center'
                }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <GraduationCap size={18} color="#a5b4fc" />
                    2. Escolha a Série & Defina o Desconto
                  </h2>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#e0e7ff', background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '3px 10px', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    Tabela Oficial {anoLetivo}
                  </span>
                </div>

                <div style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
                  {/* Grade de Séries */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
                    {seriesList.map(serie => {
                      const isSelected = serie.id === selectedSerieId
                      return (
                        <div
                          key={serie.id}
                          onClick={() => setSelectedSerieId(serie.id)}
                          style={{
                            padding: 12, borderRadius: 12, border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                            background: isSelected ? '#eff6ff' : '#ffffff', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            minHeight: 88,
                            boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.12)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: isSelected ? '#1e3a8a' : '#1e293b' }}>{serie.nome}</span>
                              {isSelected && <CheckCircle2 size={16} color="#2563eb" />}
                            </div>
                            {serie.detalhe && (
                              <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 2 }}>{serie.detalhe}</span>
                            )}
                          </div>
                          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>Mensalidade:</span>
                            <span style={{ fontSize: 12, fontWeight: 900, color: '#2563eb' }}>{fmt(serie.mensalidadeBase)}</span>
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
                        {descontoPercent}% (-{fmt(calculations.valorDescontoMensal)} / mês)
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

                    {/* Convênios Dropdown */}
                    <div style={{ marginTop: 4 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                        Convênio Institucional (Aplica 11% automático):
                      </label>
                      <select
                        value={convenioSelecionado}
                        onChange={e => handleSelectConvenio(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 10,
                          border: '1px solid #cbd5e1', background: '#f8fafc',
                          fontSize: 12, color: '#000000', fontWeight: 600, outline: 'none'
                        }}
                      >
                        <option value="">Nenhum convênio selecionado</option>
                        {CONVENIOS.map(c => (
                          <option key={c.nome} value={c.nome}>
                            {c.nome} — {c.desconto}% de desconto
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Campanha de Matrícula */}
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
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#a7f3d0', background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '3px 10px', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    Base: 1 Mensalidade
                  </span>
                </div>

                <div style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
                  {/* Meses de Antecipação */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                    {ANTECIPACAO_REGRAS.map(regra => {
                      const isSelected = mesAntecipacao === regra.mes
                      return (
                        <div
                          key={regra.mes}
                          onClick={() => setMesAntecipacao(regra.mes)}
                          style={{
                            padding: 12, borderRadius: 12, border: isSelected ? `2px solid #059669` : '1px solid #e2e8f0',
                            background: isSelected ? '#ecfdf5' : '#ffffff', cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 8px rgba(5, 150, 105, 0.15)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{regra.mes}</span>
                            {isSelected && <Check size={14} color="#059669" />}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#047857', marginTop: 4 }}>{regra.destaque}</div>
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
                          À Vista ({currentAntecipacao.aVistaPct}% desc.)
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
                          Parcelado ({currentAntecipacao.parceladoPct}% desc.)
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Parcelas do Cartão (em até 5x):</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[1, 2, 3, 4, 5].map(p => (
                            <button
                              key={p}
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

                    {/* Valor Calculado */}
                    {formaMatricula === 'ambos' ? (
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e9d5ff', background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '3px 10px', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    Marque para incluir
                  </span>
                </div>

                <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Material */}
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={incluirMaterial}
                        onChange={e => setIncluirMaterial(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }}
                      />
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', display: 'block' }}>Taxa de Material Didático / Livros</span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>{currentSerie.taxaMaterialDesc || 'Material pedagógico anual'}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#6d28d9' }}>{fmt(currentSerie.taxaMaterial || 0)}</span>
                  </label>

                  {/* Extracurricular */}
                  <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={incluirExtracurricular}
                          onChange={e => setIncluirExtracurricular(e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', display: 'block' }}>Atividades Extracurriculares (2 aulas/sem)</span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>Ballet, Jazz, Futsal, Ginástica Rítmica</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#6d28d9' }}>R$ 180,00 / mês</span>
                    </label>

                    {incluirExtracurricular && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Modalidade:</span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {SERVICOS_ADICIONAIS.atividadesExtracurriculares.map(ativ => (
                            <button
                              key={ativ}
                              onClick={() => setAtividadeSelecionada(ativ)}
                              style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                background: atividadeSelecionada === ativ ? '#7c3aed' : '#ffffff',
                                color: atividadeSelecionada === ativ ? '#ffffff' : '#475569',
                                border: atividadeSelecionada === ativ ? 'none' : '1px solid #cbd5e1'
                              }}
                            >
                              {ativ}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Card Resumo do Orçamento */}
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
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)',
                  padding: '18px 24px',
                  borderBottom: '1px solid #1e3a8a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd', display: 'block' }}>
                      Orçamento Comercial
                    </span>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', margin: 0 }}>{currentSerie.nome}</h3>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#ffffff', background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)', padding: '4px 12px', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                    Ano {anoLetivo}
                  </span>
                </div>

                <div style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                  {/* Métricas Principais */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: '12px 14px', borderRadius: 14, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: 2 }}>Mensalidade Líquida</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: '#1d4ed8', display: 'block' }}>{fmt(calculations.mensalidadeComDesconto)}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', display: 'block', marginTop: 2 }}>
                        -{fmt(calculations.valorDescontoMensal)}/mês
                      </span>
                    </div>

                    <div style={{ padding: '12px 14px', borderRadius: 14, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', display: 'block', marginBottom: 2 }}>Matrícula ({mesAntecipacao})</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: '#047857', display: 'block' }}>
                        {formaMatricula === 'ambos' ? fmt(calculations.valorMatriculaFinalAVista) : fmt(calculations.valorMatriculaFinal)}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', display: 'block', marginTop: 2 }}>
                        {formaMatricula === 'ambos'
                          ? `À vista ou ${numParcelasMatricula}x de ${fmt(calculations.valorParcelaMatricula)}`
                          : (formaMatricula === 'avista' ? 'À vista' : `${numParcelasMatricula}x de ${fmt(calculations.valorParcelaMatricula)}`)}
                      </span>
                    </div>
                  </div>

                  {/* Linhas de Detalhamento */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Mensalidade de Tabela:</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(calculations.mensalidadeOriginal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                      <span>Desconto Aplicado ({descontoPercent}%):</span>
                      <span>- {fmt(calculations.valorDescontoMensal)} / mês</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Anuidade Líquida (12x):</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(calculations.anuidadeComDesconto)}</span>
                    </div>
                    {incluirMaterial && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6d28d9', fontWeight: 700 }}>
                        <span>Material Didático:</span>
                        <span>+ {fmt(calculations.valorMaterial)}</span>
                      </div>
                    )}
                    {incluirExtracurricular && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6d28d9', fontWeight: 700 }}>
                        <span>Extracurricular ({atividadeSelecionada}):</span>
                        <span>+ {fmt(calculations.valorExtracurricular)}/mês</span>
                      </div>
                    )}

                    {/* Banner de Economia */}
                    <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: '#065f46', display: 'block' }}>
                          Economia Total no Ano
                        </span>
                        <span style={{ fontSize: 10, color: '#475569' }}>Mensalidades + Matrícula</span>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#047857' }}>
                        {fmt(calculations.economiaTotalGeral)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card WhatsApp com Gerenciador de Modelos */}
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

                  {/* Botões de Ação */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      onClick={handleCopyText}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 800, border: '1px solid #cbd5e1',
                        background: copiedSuccess ? '#059669' : '#f8fafc',
                        color: copiedSuccess ? '#ffffff' : '#1e293b',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {copiedSuccess ? <CheckCheck size={16} /> : <Copy size={16} />}
                      <span>{copiedSuccess ? 'Copiado!' : 'Copiar Texto'}</span>
                    </button>

                    <button
                      onClick={handleOpenWhatsApp}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 900, border: 'none',
                        background: '#10b981', color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <Send size={16} />
                      <span>Enviar WhatsApp</span>
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
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Descontos de antecipação com até 20% de desconto e simulação em até 5 parcelas.</p>
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
                                setSelectedSerieId(serie.id)
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
                                setSelectedSerieId(serie.id)
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

        {/* ─── ABA 4: SERVIÇOS & CONVÊNIOS COM GRADIENTES SUAVES ─── */}
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
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Taxa por Matéria</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#d97706' }}>R$ 300,00</span>
                </div>
              </div>
            </div>

            {/* Card 3: Material */}
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 50%, #4c1d95 100%)', padding: '16px 20px', borderBottom: '1px solid #2e1065', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', color: '#c084fc', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}><Layers size={18} /></div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0 }}>Taxa de Material</h3>
                  <span style={{ fontSize: 11, color: '#e9d5ff' }}>Nível 1</span>
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ padding: '14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Nível 1 (Anual)</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#7c3aed' }}>R$ 480,00</span>
                </div>
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
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#2563eb' }}>R$ 180,00</span>
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
                  const isDefaultTemplate = DEFAULT_VALORES_TEMPLATES.some(d => d.id === tpl.id)
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
                      {!isDefaultTemplate && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteTemplate(tpl.id) }}
                          title="Excluir modelo"
                          disabled={isSavingDb}
                          style={{
                            padding: '4px 6px', border: 'none',
                            background: 'transparent',
                            color: isCurrent ? '#ef4444' : '#94a3b8',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            borderLeft: '1px solid #e2e8f0'
                          }}
                        >
                          <Trash2 size={12} />
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

              {/* Pílulas de Variáveis Dinâmicas */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 8 }}>
                  ⚡ Clique nas tags abaixo para inserir valores automáticos no texto:
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v.tag}
                      onClick={() => handleInsertTag(v.tag)}
                      title={v.desc}
                      style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: '1px solid #bfdbfe', background: '#ffffff', color: '#1d4ed8',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <span>{v.tag}</span>
                    </button>
                  ))}
                </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <button
                  onClick={handleRestoreDefaults}
                  disabled={isSavingDb}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                    border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={14} />
                  Restaurar Padrões de Fábrica
                </button>

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
