'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Send, Copy, Check, Search, Plus, Edit3, Trash2, 
  RotateCcw, Sparkles, User, Phone, CheckCircle2, ChevronRight,
  ExternalLink, Layers, GraduationCap, ShieldCheck, HelpCircle,
  FileText, Calendar, Filter, Share2, Smartphone, ArrowUpRight,
  SlidersHorizontal, Download, Upload, Info, RefreshCw, X, CalendarDays,
  CopyPlus, CheckCheck, Loader2, Users
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useConfigDb } from '@/lib/useConfigDb'

export interface WhatsAppTemplate {
  id: string
  titulo: string
  segmento: string
  anoLetivo: string
  atalho: string
  destaque?: string
  conteudo: string
  tags?: string[]
  criadoEm?: string
  atualizadoEm?: string
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

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-villa-baby-2026',
    titulo: 'Villa Baby – Nível 1 e Nível 2 (2026)',
    segmento: 'Villa Baby',
    anoLetivo: '2026',
    atalho: '/baby',
    destaque: 'Berçário & Níveis 1 e 2',
    tags: ['Villa Baby', '2026', 'Desconto Pontualidade', 'Almoço Cortesia'],
    conteudo: `✨*2026 – VILLA BABY – Nível 1 e Nível 2*
*MEIO PERÍODO* - DIA DA FRUTA CORTESIA = *R$ 1.365,00*
*INTERMEDIÁRIO* DIA DA FRUTA E ALMOÇO CORTESIA = *R$ 1.795,00*
*INTEGRAL* DIA DA FRUTA E ALMOÇO CORTESIA = *R$ 2.075,00*

🗂*Materiais* _- Parcelamento em até 10x no cartão de crédito._
Taxa de material anual (Nível 1) = *R$ 520,00*
Nível 2: LIVROS (ANUAL) = *R$ 600,00*

*MATRÍCULAS* 📚 _- PARCELAMENTO EM ATÉ 5X._

*À VISTA:*
OUTUBRO (15%)
- MEIO PERÍODO = R$ 1.160,25
- INTERMEDIÁRIO = R$ 1.525,75
- INTEGRAL = R$ 1.763,75

NOVEMBRO (10%)
- MEIO PERÍODO = R$ 1.228,50
- INTERMEDIÁRIO = R$ 1.615,50
- INTEGRAL = R$ 1.867,50

DEZEMBRO (5%)
- MEIO PERÍODO = R$ 1.296,75
- INTERMEDIÁRIO = R$ 1.705,25
- INTEGRAL = R$ 1.971,25`
  },
  {
    id: 'tpl-ed-infantil-2026',
    titulo: 'Ed. Infantil – Nível 3 ao Nível 5 (2026)',
    segmento: 'Educação Infantil',
    anoLetivo: '2026',
    atalho: '/inf',
    destaque: 'Nível 3 ao Nível 5',
    tags: ['Educação Infantil', '2026', 'Almoço Incluso', 'Socioemocional'],
    conteudo: `✨*2026 – ED. INFANTIL – do Nível 3 ao Nível 5*
*MEIO PERÍODO* = *R$ 1.150,00*
*INTERMEDIÁRIO* = *R$ 1.795,00* - ALMOÇO INCLUSO
*INTEGRAL* = *R$ 2.075,00* - ALMOÇO INCLUSO

🗂 LIVROS (ANUAL) + SOCIOEMOCIONAL = *R$ 1.285,00*
_Parcelamento em até 10x no cartão de crédito. Ou no boleto com taxa._

*MATRÍCULAS* 📚 _- PARCELAMENTO EM ATÉ 5X._

*À VISTA:*
OUTUBRO (15%)
- MEIO PERÍODO = R$ 977,50
- INTERMEDIÁRIO = R$ 1.525,75
- INTEGRAL = R$ 1.763,75

NOVEMBRO (10%)
- MEIO PERÍODO = R$ 1.035,00
- INTERMEDIÁRIO = R$ 1.615,50
- INTEGRAL = R$ 1.867,50

DEZEMBRO (5%)
- MEIO PERÍODO = R$ 1.092,50
- INTERMEDIÁRIO = R$ 1.705,25
- INTEGRAL = R$ 1.971,25`
  },
  {
    id: 'tpl-fund1-2026',
    titulo: 'Ensino Fundamental I – 1º ao 5º Ano (2026)',
    segmento: 'Ensino Fundamental I',
    anoLetivo: '2026',
    atalho: '/fund1',
    destaque: '1º ao 5º Ano',
    tags: ['Fundamental I', '2026', 'Bilingue', 'Projetos'],
    conteudo: `✨*2026 – ENSINO FUNDAMENTAL I – 1º ao 5º Ano*
*MEIO PERÍODO* = *R$ 1.290,00*
*SEMI-INTEGRAL* = *R$ 1.890,00* - ALMOÇO INCLUSO
*INTEGRAL COMPLETO* = *R$ 2.190,00* - ALMOÇO + LANCHE INCLUSOS

🗂 *SISTEMA DE ENSINO & PLATAFORMA DIGITAL (ANUAL)* = *R$ 1.450,00*
_Parcelamento em até 10x no cartão de crédito sem juros._

*MATRÍCULAS & ANUIDADE* 📚 _- CONDIÇÕES ESPECIAIS:_

*À VISTA COM DESCONTO ANTECIPADO:*
• OUTUBRO (15% OFF): R$ 1.096,50 (Meio Período)
• NOVEMBRO (10% OFF): R$ 1.161,00 (Meio Período)
• DEZEMBRO (5% OFF): R$ 1.225,50 (Meio Período)

_Parcelamento da Matrícula em até 5x sem juros._`
  },
  {
    id: 'tpl-fund2-2026',
    titulo: 'Ensino Fundamental II – 6º ao 9º Ano (2026)',
    segmento: 'Ensino Fundamental II',
    anoLetivo: '2026',
    atalho: '/fund2',
    destaque: '6º ao 9º Ano',
    tags: ['Fundamental II', '2026', 'Laboratórios', 'Robótica'],
    conteudo: `✨*2026 – ENSINO FUNDAMENTAL II – 6º ao 9º Ano*
*TURNO MANHÃ / TARDE* = *R$ 1.380,00*
*PROGRAMA INTEGRAL & MONITORIA* = *R$ 2.250,00* - ALMOÇO INCLUSO

🗂 *MATERIAL DIDÁTICO / SISTEMA PEDAGÓGICO (ANUAL)* = *R$ 1.580,00*
_Parcelamento em até 10x no cartão de crédito._

*CONDIÇÕES DE MATRÍCULA & ANUIDADE 2026:* 📚
• OUTUBRO (15% OFF à vista): R$ 1.173,00
• NOVEMBRO (10% OFF à vista): R$ 1.242,00
• DEZEMBRO (5% OFF à vista): R$ 1.311,00

_Taxa de matrícula facilitada em até 5 parcelas._`
  },
  {
    id: 'tpl-medio-2026',
    titulo: 'Ensino Médio & Terceirão (2026)',
    segmento: 'Ensino Médio',
    anoLetivo: '2026',
    atalho: '/medio',
    destaque: '1ª, 2ª e 3ª Séries (Terceirão)',
    tags: ['Ensino Médio', '2026', 'ENEM', 'Simulados TRI'],
    conteudo: `✨*2026 – ENSINO MÉDIO & TERCEIRÃO – Colégio Impacto*
*MENSALIDADE REGULAR* = *R$ 1.540,00*
*ALTA PERFORMANCE / ITINERÁRIOS + ENEM* = *R$ 1.780,00*

🗂 *MATERIAL DIDÁTICO + PLATAFORMA DE REDAÇÃO & SIMULADOS (ANUAL)* = *R$ 1.850,00*
_Parcelamento em até 10x no cartão de crédito._

*DESCONTOS ESPECIAIS DE ANTECIPAÇÃO:* 📚
• OUTUBRO (15% OFF à vista): R$ 1.309,00
• NOVEMBRO (10% OFF à vista): R$ 1.386,00
• DEZEMBRO (5% OFF à vista): R$ 1.463,00

_Vagas limitadas por turma para foco individualizado._`
  },
  {
    id: 'tpl-documentos-2026',
    titulo: 'Documentação Necessária para Matrícula (2026)',
    segmento: 'Documentos & Secretaria',
    anoLetivo: '2026',
    atalho: '/documentos',
    destaque: 'Secretaria Escolar',
    tags: ['Documentos', 'Secretaria', 'Checklist', 'Contrato'],
    conteudo: `📋 *DOCUMENTAÇÃO PARA EFETIVAÇÃO DE MATRÍCULA 2026*

*Do Aluno:*
- Certidão de Nascimento / RG e CPF do aluno
- 1 Foto 3x4 recente
- Declaração de Transferência ou Histórico Escolar original
- Declaração de Quitação da escola anterior
- Cópia da Carteira de Vacinação atualizada (Ed. Infantil)
- Laudo médico ou relatório de saúde (quando aplicável)

*Dos Responsáveis (Financeiro e Pedagógico):*
- Cópia do RG e CPF
- Comprovante de Residência recente (água, luz ou gás)

📍 *Atendimento Secretaria:* Seg a Sex das 07h30 às 18h00.
Dúvidas ou envio digital: responder por este WhatsApp.`
  },
  {
    id: 'tpl-visita-2026',
    titulo: 'Boas-Vindas & Agendamento de Visita',
    segmento: 'Atendimento & Recepção',
    anoLetivo: '2026',
    atalho: '/visita',
    destaque: 'Acolhimento de Famílias',
    tags: ['Boas-Vindas', 'Agendamento', 'Visita Guiada'],
    conteudo: `Olá! É uma grande alegria receber o seu contato com o *Colégio Impacto*! 🏫✨

Aqui, proporcionamos uma experiência de excelência pedagógica, acolhimento socioemocional e estrutura completa para o pleno desenvolvimento do seu filho(a).

Gostaríamos de convidá-los para uma *Visita Guiada Personalizada* com a nossa Equipe de Coordenação:
🗓 *Disponibilidade:* Segunda a Sexta-feira
⏰ *Horários flexíveis:* Manhã ou Tarde

Qual o melhor dia e horário para recebê-los com um café especial? Ficamos à disposição!`
  },
  {
    id: 'tpl-rematricula-2026',
    titulo: 'Campanha de Rematrícula – Veteranos',
    segmento: 'Rematrícula & Fidelidade',
    anoLetivo: '2026',
    atalho: '/rematricula',
    destaque: 'Garantia de Vaga & 15% OFF',
    tags: ['Rematrícula', 'Veteranos', 'Desconto Pontualidade', 'Fidelidade'],
    conteudo: `Olá, {nome_responsavel}! É uma imensa alegria ter a sua família caminhando conosco no *Colégio Impacto*! 🏫✨

A jornada do(a) *{nome_aluno}* é motivo de muito orgulho para toda a nossa equipe. E para continuarmos construindo esse futuro brilhante juntos, iniciamos com exclusividade o período de *REMATRÍCULAS {ano_letivo}* para alunos veteranos!

🌟 *VANTAGENS EXCLUSIVAS DE RENOVAÇÃO ANTECIPADA:*
• *Garantia da vaga* no mesmo turno e turma
• *Desconto especial de pontualidade* (15% OFF até {data_limite_desconto})
• Parcelamento da matrícula facilitado em até 5x sem juros

Podemos adiantar a renovação por aqui ou preferem agendar um atendimento presencial na secretaria? 💙`
  },
  {
    id: 'tpl-aviso-rematricula-2026',
    titulo: 'Lembrete: Últimos Dias com 15% de Desconto (Rematrícula)',
    segmento: 'Rematrícula & Fidelidade',
    anoLetivo: '2026',
    atalho: '/aviso-rematricula',
    destaque: 'Prazo de Desconto',
    tags: ['Rematrícula', 'Lembrete', 'Urgência Positiva', 'Economia'],
    conteudo: `Olá, {nome_responsavel}! Passando para um lembrete com carinho! ⏰✨

O prazo para garantir a *Rematrícula {ano_letivo}* do(a) *{nome_aluno}* com o *Desconto Máximo de 15% OFF à vista* encerra-se em breve (até {data_limite_desconto}).

Além da economia garantida, você assegura a preferência de turno e turma do seu filho(a) antes da abertura para novos alunos externos.

Deseja que eu envie o link direto para assinatura digital do contrato ou a chave PIX/boleto com desconto aplicado? 📱📚`
  },
  {
    id: 'tpl-acolhimento-2026',
    titulo: 'Acolhimento & Apresentação Institucional',
    segmento: 'Atendimento & Recepção',
    anoLetivo: '2026',
    atalho: '/acolhimento',
    destaque: 'Primeiro Contato com Famílias',
    tags: ['Acolhimento', 'Novos Alunos', 'Apresentação', 'Valores'],
    conteudo: `Olá, {nome_responsavel}! Seja muito bem-vindo(a) ao *Colégio Impacto*! 🌟🎒

Ficamos muito felizes com o seu interesse em conhecer a nossa escola para o(a) *{nome_aluno}*.

Aqui no Impacto, unimos *excelência acadêmica*, *desenvolvimento socioemocional*, *tecnologia aplicada* e um *acompanhamento individualizado*, preparando cada estudante para os desafios da vida e dos grandes vestibulares.

Qual o melhor turno (manhã ou tarde) e a série de interesse para eu compartilhar a grade curricular e a tabela completa de valores? Ficamos à disposição!`
  },
  {
    id: 'tpl-vivencia-2026',
    titulo: 'Convite: Dia de Vivência & Aula Experimental',
    segmento: 'Atendimento & Recepção',
    anoLetivo: '2026',
    atalho: '/vivencia',
    destaque: 'Experiência do Aluno',
    tags: ['Aula Experimental', 'Vivência', 'Interação', 'Laboratórios'],
    conteudo: `Olá, {nome_responsavel}! Que tal proporcionar uma experiência inesquecível para o(a) *{nome_aluno}*? 🎨🔬

Convidamos seu filho(a) para passar uma manhã/tarde conosco em um *Dia de Vivência no Colégio Impacto*!

Nesse dia, ele(a) poderá:
✅ Participar das oficinas práticas (Laboratório, Maker e Robótica)
✅ Conhecer a nossa equipe de professores e metodologia
✅ Interagir com os futuros colegas de turma em um ambiente acolhedor

Tudo 100% gratuito e sem compromisso! Qual dia da próxima semana seria ideal para agendarmos? 📅✨`
  },
  {
    id: 'tpl-pos-visita-2026',
    titulo: 'Agradecimento Pós-Visita Guiada',
    segmento: 'Atendimento & Recepção',
    anoLetivo: '2026',
    atalho: '/pos-visita',
    destaque: 'Follow-up Encantador',
    tags: ['Pós-Visita', 'Encantamento', 'Secretaria', 'Reserva'],
    conteudo: `Olá, {nome_responsavel}! Foi um imenso prazer receber você e o(a) *{nome_aluno}* hoje no *Colégio Impacto*! 🏫☕

Esperamos que tenham sentido o carinho, a segurança e a energia vibrante que cultivamos diariamente em nossos corredores e salas de aula.

Estou à disposição para esclarecer qualquer dúvida sobre o nosso projeto pedagógico ou simular as melhores opções de condições de pagamento para o *Ano Letivo {ano_letivo}*.

Caso queiram já reservar a vaga, posso encaminhar o link do formulário de matrícula online! 📝✨`
  },
  {
    id: 'tpl-irmaos-2026',
    titulo: 'Condição Especial para Irmãos (Desconto Família)',
    segmento: 'Rematrícula & Fidelidade',
    anoLetivo: '2026',
    atalho: '/irmaos',
    destaque: 'Desconto Progressivo',
    tags: ['Irmãos', 'Desconto Família', 'Benefícios', 'Economia'],
    conteudo: `Olá, {nome_responsavel}! Família unida aprende junta no *Colégio Impacto*! 👨‍👩‍👧‍👦💙

Sabia que oferecemos condições especiais progressivas para irmãos matriculados no *Ano Letivo {ano_letivo}*?

✨ *POLÍTICA DE DESCONTO FAMÍLIA:*
• 2º Filho: *10% de desconto adicional* nas mensalidades
• 3º Filho em diante: *15% de desconto adicional*
• Condições facilitadas no parcelamento de materiais escolares

Gostaria de uma simulação personalizada combinando os valores das turmas dos seus filhos? Me avise para calcularmos a melhor proposta!`
  },
  {
    id: 'tpl-bolsas-2026',
    titulo: 'Concurso de Bolsas & Avaliação de Mérito',
    segmento: 'Atendimento & Recepção',
    anoLetivo: '2026',
    atalho: '/bolsas',
    destaque: 'Bolsas de Estudo até 100%',
    tags: ['Bolsas', 'Mérito', 'Simulado', 'Inscrição Gratuita'],
    conteudo: `Olá, {nome_responsavel}! Temos uma grande oportunidade para o futuro do(a) *{nome_aluno}*! 🎯🏆

Estão abertas as inscrições para o *Concurso de Bolsas de Estudo {ano_letivo}* do Colégio Impacto, com descontos de mérito acadêmico de até *100%* nas mensalidades!

📝 *INFORMAÇÕES DA PROVA:*
• *Público:* Ensino Fundamental II e Ensino Médio
• *Conteúdos:* Raciocínio Lógico, Língua Portuguesa e Redação
• *Inscrição:* 100% Gratuita

Gostaria de garantir a inscrição do(a) *{nome_aluno}*? Responda com "QUERO A BOLSA" e enviaremos o link imediato! 🚀`
  },
  {
    id: 'tpl-contrato-2026',
    titulo: 'Passo a Passo: Assinatura Digital do Contrato',
    segmento: 'Documentos & Secretaria',
    anoLetivo: '2026',
    atalho: '/contrato',
    destaque: 'Efetivação 100% Online',
    tags: ['Contrato', 'Assinatura Digital', 'Secretaria', 'Sem Filas'],
    conteudo: `Olá, {nome_responsavel}! Parabéns por dar esse passo tão importante na formação do(a) *{nome_aluno}*! 🎉📚

Para sua comodidade, a efetivação da matrícula para o *Ano Letivo {ano_letivo}* é 100% digital, rápida e segura:

📱 *COMO CONCLUIR EM 3 MINUTOS:*
1️⃣ Acesse o link enviado no seu WhatsApp/E-mail
2️⃣ Confira os dados cadastrais e o plano de pagamento escolhido
3️⃣ Clique em "Assinar Digitalmente" pelo próprio celular
4️⃣ Efetue o pagamento da matrícula (PIX, Boleto ou Cartão em até 5x)

Qualquer dúvida no processo, nossa secretaria está conectada para te auxiliar em tempo real!`
  }
]

const STORAGE_KEY = 'colegio_impacto_whatsapp_templates_v5'

export default function WhatsAppMatriculasPage() {
  const { alunos = [], cfgCalendarioLetivo = [] } = useData()

  // Sincronização em tempo real com o Banco de Dados (Supabase)
  const { data: dbTemplates = [], setData: setDbTemplates, loading: loadingDb, error: dbError } = useConfigDb<WhatsAppTemplate>('cfgWhatsAppMatriculas', DEFAULT_TEMPLATES)
  
  const templates = dbTemplates

  // Determinar ano vigente
  const anoVigente = useMemo(() => {
    const found = cfgCalendarioLetivo?.find((c: any) => c.isVigente)?.ano
    return found ? String(found) : '2026'
  }, [cfgCalendarioLetivo])

  // Estados principais
  const [selectedAnoLetivo, setSelectedAnoLetivo] = useState<string>('2026')
  const [selectedSegment, setSelectedSegment] = useState<string>('Todos')
  const [searchTerm, setSearchTerm] = useState<string>('')
  
  // Destinatário rápido & Busca Inteligente de Alunos/Responsáveis na Base
  const [recipientName, setRecipientName] = useState<string>('')
  const [recipientPhone, setRecipientPhone] = useState<string>('')
  const [studentName, setStudentName] = useState<string>('')
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('')
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false)
  const [isSearchingStudents, setIsSearchingStudents] = useState(false)
  const [availableResponsaveis, setAvailableResponsaveis] = useState<ResponsavelOption[]>([])
  const [selectedResponsavelId, setSelectedResponsavelId] = useState<string | null>(null)
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchResult[]>([])
  
  const searchContainerRef = React.useRef<HTMLDivElement>(null)

  // Modais e Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toastText, setToastText] = useState<string | null>(null)
  const [activeEditorModal, setActiveEditorModal] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    template: WhatsAppTemplate
  }>({
    isOpen: false,
    mode: 'create',
    template: {
      id: '',
      titulo: '',
      segmento: 'Villa Baby',
      anoLetivo: '2026',
      atalho: '',
      destaque: '',
      conteudo: '',
      tags: []
    }
  })
  
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  // Salvar no Banco de Dados (Supabase) + Backup Local
  const saveTemplates = (newTemplates: WhatsAppTemplate[]) => {
    setDbTemplates(newTemplates)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates))
    } catch (e) {
      console.error('Erro ao salvar no storage local:', e)
    }
  }

  // Toast
  const showToast = (msg: string) => {
    setToastText(msg)
    setTimeout(() => {
      setToastText(null)
    }, 3000)
  }

  // Anos Letivos Disponíveis (Apenas anos cadastrados em cfgCalendarioLetivo e nos templates)
  const anosDisponiveis = useMemo(() => {
    const fromConfig = (cfgCalendarioLetivo || []).map((c: any) => String(c.ano || ''))
    const fromTemplates = templates.map(t => String(t.anoLetivo || ''))
    const set = new Set([...fromConfig, ...fromTemplates].filter(Boolean))
    if (set.size === 0) set.add('2026')
    return Array.from(set).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [cfgCalendarioLetivo, templates])

  // Selecionar SEMPRE o último (mais recente) ano letivo por padrão
  useEffect(() => {
    if (anosDisponiveis.length > 0) {
      const ultimoAno = anosDisponiveis[0]
      setSelectedAnoLetivo(ultimoAno)
    }
  }, [anosDisponiveis])

  // Filtrar templates pelo Ano Selecionado
  const templatesDoAno = useMemo(() => {
    return templates.filter(t => (t.anoLetivo || '2026') === selectedAnoLetivo)
  }, [templates, selectedAnoLetivo])

  // Segmentos únicos
  const segmentos = useMemo(() => {
    const list = Array.from(new Set(templatesDoAno.map(t => t.segmento)))
    return ['Todos', ...list]
  }, [templatesDoAno])

  // Filtragem Final
  const filteredTemplates = useMemo(() => {
    return templatesDoAno.filter(t => {
      const matchesSegment = selectedSegment === 'Todos' || t.segmento === selectedSegment
      const search = searchTerm.toLowerCase().trim()
      const matchesSearch = !search || 
        t.titulo.toLowerCase().includes(search) ||
        t.atalho.toLowerCase().includes(search) ||
        t.segmento.toLowerCase().includes(search) ||
        t.conteudo.toLowerCase().includes(search) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(search)))
      return matchesSegment && matchesSearch
    })
  }, [templatesDoAno, selectedSegment, searchTerm])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsStudentDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Extrair todos os responsáveis de um aluno
  const extractResponsaveisDoAluno = (a: any): ResponsavelOption[] => {
    const list: ResponsavelOption[] = []

    const addOrMergeResp = (tipo: string, nome: any, tel: any, id?: string) => {
      if (!nome || typeof nome !== 'string') return
      const cleanNome = nome.trim()
      if (!cleanNome || cleanNome.length < 2) return
      
      const cleanTel = (tel && String(tel).trim()) ? formatPhoneNumber(String(tel).trim()) : ''

      // Se já existe um responsável com esse mesmo nome (evita duplicatas da mesma pessoa)
      const existing = list.find(r => r.nome.toLowerCase() === cleanNome.toLowerCase())
      if (existing) {
        // Se o existente estava sem telefone e este tem, atualiza
        if (!existing.telefone && cleanTel) {
          existing.telefone = cleanTel
        }
        // Se o tipo atual for mais específico (ex: 'Resp. Pedagógico' ou 'Mãe'), adota o tipo mais descritivo
        if (existing.tipo === 'Responsável' && tipo !== 'Responsável') {
          existing.tipo = tipo
        }
        if (id && !existing.id.startsWith('resp-db-')) {
          existing.id = id
        }
        return
      }

      list.push({
        id: id || `resp-${list.length + 1}-${Math.random().toString(36).substring(2, 6)}`,
        tipo,
        nome: cleanNome,
        telefone: cleanTel
      })
    }

    // 0. Vínculos reais e detalhados da tabela aluno_responsavel
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

    // 1. Responsável Financeiro
    const rfNome = a.responsavel_financeiro || a.dados?.responsavel_financeiro?.nome || a.dados?.responsavelFinanceiro?.nome
    const rfTel = a.tel_responsavel_financeiro || a.dados?.responsavel_financeiro?.celular || a.dados?.responsavel_financeiro?.telefone || a.dados?.responsavelFinanceiro?.celular || a.dados?.responsavelFinanceiro?.telefone
    if (rfNome) addOrMergeResp('Resp. Financeiro', rfNome, rfTel)

    // 2. Mãe
    const maeNome = a.dados?.mae?.nome || a.dados?.filiacao1?.nome
    const maeTel = a.dados?.mae?.celular || a.dados?.mae?.telefone || a.dados?.filiacao1?.celular || a.dados?.filiacao1?.telefone
    if (maeNome) addOrMergeResp('Mãe', maeNome, maeTel)

    // 3. Pai
    const paiNome = a.dados?.pai?.nome || a.dados?.filiacao2?.nome
    const paiTel = a.dados?.pai?.celular || a.dados?.pai?.telefone || a.dados?.filiacao2?.celular || a.dados?.filiacao2?.telefone
    if (paiNome) addOrMergeResp('Pai', paiNome, paiTel)

    // 4. Responsável Pedagógico
    const rpNome = a.responsavel_pedagogico || a.dados?.responsavel_pedagogico?.nome || a.dados?.responsavelPedagogico?.nome
    const rpTel = a.tel_responsavel_pedagogico || a.dados?.responsavel_pedagogico?.celular || a.dados?.responsavel_pedagogico?.telefone || a.dados?.responsavelPedagogico?.celular || a.dados?.responsavelPedagogico?.telefone
    if (rpNome) addOrMergeResp('Resp. Pedagógico', rpNome, rpTel)

    // 5. Lista de outros responsáveis em dados.responsaveis
    if (Array.isArray(a.dados?.responsaveis)) {
      for (const r of a.dados.responsaveis) {
        if (r && r.nome) {
          addOrMergeResp(r.parentesco || r.tipo || 'Responsável', r.nome, r.celular || r.telefone, r.id)
        }
      }
    }

    // 6. Campo geral responsavel
    if (a.responsavel) {
      addOrMergeResp('Responsável', a.responsavel, a.telefone || a.tel_responsavel)
    }

    return list
  }

  // Busca assíncrona em tempo real nas APIs de alunos e responsáveis
  useEffect(() => {
    const q = studentSearchQuery.trim()
    if (q.length < 2) {
      setStudentSearchResults([])
      setIsSearchingStudents(false)
      return
    }

    // Se já selecionou e o texto bate com o formato selecionado, não precisa rebuscar
    if (studentName && q.includes(studentName)) {
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

        // 1. Processar Alunos
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

        // 2. Processar Responsáveis
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
                    if (tel) {
                      match.telefone = formatPhoneNumber(tel)
                    }
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
  }, [studentSearchQuery, studentName])

  // Telefone formatado
  const formatPhoneNumber = (val: any): string => {
    if (!val) return ''
    const digits = String(val).replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
  }

  // Selecionar Aluno e Responsável
  const handleSelectStudentAndGuardian = (student: StudentSearchResult, specificResp?: ResponsavelOption) => {
    setStudentName(student.nomeAluno)
    setAvailableResponsaveis(student.responsaveis)

    // Escolhe o responsável específico ou o primeiro que possua telefone (ou o primeiro da lista)
    const targetResp = specificResp || student.responsaveis.find(r => !!r.telefone) || student.responsaveis[0]
    if (targetResp) {
      setSelectedResponsavelId(targetResp.id)
      setRecipientName(targetResp.nome)
      setRecipientPhone(formatPhoneNumber(targetResp.telefone))
    } else {
      setSelectedResponsavelId(null)
      setRecipientName('')
      setRecipientPhone('')
    }

    const label = student.nomeAluno || targetResp?.nome || ''
    setStudentSearchQuery(label)
    setIsStudentDropdownOpen(false)
    showToast(`Selecionado: ${student.nomeAluno || targetResp?.nome} ✨`)

    // Sincronização em segundo plano com a API completa do aluno para buscar telefones individuais da tabela responsaveis
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

              const tel = r.telefone || r.celular || r.tel || ''
              return {
                id: r.id || `resp-detail-${idx}`,
                tipo,
                nome: r.nome || '',
                telefone: formatPhoneNumber(tel)
              }
            }).filter((r: ResponsavelOption) => r.nome && r.nome.length > 1)

            if (detailedList.length > 0) {
              setAvailableResponsaveis(detailedList)
              // Atualiza o telefone do responsável ativo caso encontrado na lista detalhada
              const activeName = (specificResp?.nome || targetResp?.nome || '').toLowerCase()
              const activeInDetails = detailedList.find(r => r.nome.toLowerCase() === activeName) || detailedList[0]
              if (activeInDetails) {
                setSelectedResponsavelId(activeInDetails.id)
                setRecipientName(activeInDetails.nome)
                setRecipientPhone(formatPhoneNumber(activeInDetails.telefone))
              }
            }
          }
        })
        .catch(err => console.error('Erro ao sincronizar telefones individuais:', err))
    }
  }

  // Injeção de variáveis dinâmicas
  const processDynamicText = (rawText: string) => {
    let result = rawText
    if (recipientName.trim()) {
      result = result.replace(/{nome_responsavel}/gi, recipientName.trim())
    } else {
      result = result.replace(/{nome_responsavel}/gi, 'Prezados Pais')
    }

    if (studentName.trim()) {
      result = result.replace(/{nome_aluno}/gi, studentName.trim())
    } else {
      result = result.replace(/{nome_aluno}/gi, 'aluno(a)')
    }

    result = result.replace(/{ano_letivo}/gi, selectedAnoLetivo)
    result = result.replace(/{data_limite_desconto}/gi, '31 de Outubro')
    result = result.replace(/{contato_secretaria}/gi, '(11) 99999-9999')
    return result
  }

  // Copiar
  const handleCopy = async (template: WhatsAppTemplate) => {
    try {
      const textToCopy = processDynamicText(template.conteudo)
      await navigator.clipboard.writeText(textToCopy)
      setCopiedId(template.id)
      showToast(`Copiado para a área de transferência! 📋`)
      setTimeout(() => setCopiedId(null), 2500)
    } catch (err) {
      console.error('Falha ao copiar:', err)
      showToast('Erro ao copiar texto.')
    }
  }

  // Disparar WhatsApp
  const handleSendWhatsApp = (template: WhatsAppTemplate) => {
    const textToSend = processDynamicText(template.conteudo)
    const encoded = encodeURIComponent(textToSend)
    const cleanPhone = recipientPhone.replace(/\D/g, '')

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

  // Modais
  const handleOpenCreateModal = () => {
    setActiveEditorModal({
      isOpen: true,
      mode: 'create',
      template: {
        id: `tpl-${Date.now()}`,
        titulo: '',
        segmento: selectedSegment === 'Todos' ? 'Villa Baby' : selectedSegment,
        anoLetivo: selectedAnoLetivo,
        atalho: '/',
        destaque: '',
        conteudo: '',
        tags: [selectedAnoLetivo]
      }
    })
  }

  const handleOpenEditModal = (tpl: WhatsAppTemplate) => {
    setActiveEditorModal({
      isOpen: true,
      mode: 'edit',
      template: { ...tpl }
    })
  }

  const handleSaveModalTemplate = () => {
    const tpl = activeEditorModal.template
    if (!tpl.titulo.trim() || !tpl.conteudo.trim()) {
      alert('Por favor, preencha o Título e o Conteúdo.')
      return
    }

    let updated: WhatsAppTemplate[] = []
    if (activeEditorModal.mode === 'create') {
      updated = [
        ...templates,
        {
          ...tpl,
          id: tpl.id || `tpl-${Date.now()}`,
          anoLetivo: tpl.anoLetivo || selectedAnoLetivo,
          atalho: tpl.atalho.startsWith('/') ? tpl.atalho : `/${tpl.atalho}`,
          criadoEm: new Date().toISOString()
        }
      ]
      showToast(`Modelo criado com sucesso! ✨`)
    } else {
      updated = templates.map(t => t.id === tpl.id ? { ...tpl, atualizadoEm: new Date().toISOString() } : t)
      showToast('Modelo salvo! 💾')
    }

    saveTemplates(updated)
    setActiveEditorModal(prev => ({ ...prev, isOpen: false }))
  }

  const handleDeleteTemplate = (id: string, title: string) => {
    if (window.confirm(`Tem certeza que deseja excluir "${title}"?`)) {
      const updated = templates.filter(t => t.id !== id)
      saveTemplates(updated)
      showToast('Modelo excluído.')
    }
  }

  const handleDuplicateTemplate = (tpl: WhatsAppTemplate) => {
    const duplicated: WhatsAppTemplate = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      titulo: `${tpl.titulo} (Cópia)`,
      atalho: `${tpl.atalho}-copia`,
      criadoEm: new Date().toISOString()
    }
    const updated = [...templates, duplicated]
    saveTemplates(updated)
    showToast('Modelo duplicado com sucesso!')
  }

  const handleCloneTemplatesToCurrentYear = () => {
    const templates2026 = templates.filter(t => (t.anoLetivo || '2026') === '2026')
    if (templates2026.length === 0) {
      showToast('Não há modelos de 2026 para clonar.')
      return
    }

    const cloned = templates2026.map(t => ({
      ...t,
      id: `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      anoLetivo: selectedAnoLetivo,
      titulo: t.titulo.replace(/2026/g, selectedAnoLetivo),
      conteudo: t.conteudo.replace(/2026/g, selectedAnoLetivo),
      criadoEm: new Date().toISOString()
    }))

    const updated = [...templates, ...cloned]
    saveTemplates(updated)
    showToast(`${cloned.length} modelos clonados para ${selectedAnoLetivo}! 🚀`)
  }

  const handleRestoreDefaults = () => {
    saveTemplates(DEFAULT_TEMPLATES)
    setShowRestoreModal(false)
    showToast('Modelos originais restaurados! 🔄')
  }

  // Renderização estilo WhatsApp
  const renderFormattedWhatsAppPreview = (text: string) => {
    const processed = processDynamicText(text)
    const lines = processed.split('\n')
    return (
      <div className="text-[13px] leading-relaxed select-text space-y-1 font-sans">
        {lines.map((line, idx) => {
          if (!line) return <div key={idx} className="h-2" />
          
          let formatted = line
            .replace(/\*([^\*]+)\*/g, '<strong class="font-bold text-emerald-100">$1</strong>')
            .replace(/_([^_]+)_/g, '<em class="italic text-emerald-200/90">$1</em>')
            .replace(/~([^~]+)~/g, '<del class="line-through opacity-70">$1</del>')

          return (
            <div 
              key={idx} 
              dangerouslySetInnerHTML={{ __html: formatted }}
              className="text-white/95"
            />
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      
      {/* Toast Flutuante */}
      <AnimatePresence>
        {toastText && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: 'fixed', top: 24, right: 24, zIndex: 9999,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 20px', borderRadius: 16,
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white', fontWeight: 700, fontSize: 13,
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            <CheckCheck size={18} />
            <span>{toastText}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 1. CABEÇALHO PRINCIPAL ULTRA MODERNO ─── */}
      <div
        style={{
          background: 'linear-gradient(145deg, #0f132e 0%, #080a1b 100%)',
          borderRadius: 24,
          padding: '28px 32px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Glow de fundo */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(121, 40, 202, 0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0, 210, 255, 0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 16,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)',
              color: 'white', flexShrink: 0
            }}>
              <MessageSquare size={26} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{
                  background: 'rgba(0, 210, 255, 0.15)',
                  border: '1px solid rgba(0, 210, 255, 0.3)',
                  color: '#00d2ff', fontSize: 11, fontWeight: 800,
                  padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                  Matrículas {selectedAnoLetivo}
                </span>

                <span style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399', fontSize: 11, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 20,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                  {loadingDb ? 'Sincronizando...' : 'Banco de Dados Conectado'}
                </span>

                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
                  • Atendimento Ágil & Compartilhamento WhatsApp
                </span>
              </div>

              <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', margin: '0 0 6px', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>
                Envio de Mensagens p/ WhatsApp
              </h1>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', margin: 0, maxWidth: 650 }}>
                Tabelas de valores, materiais e mensagens pré-formatadas prontas para copiar ou enviar com 1 clique para as famílias.
              </p>
            </div>
          </div>

          {/* Botões de Ação do Topo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenCreateModal}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #FF0080 0%, #7928CA 100%)',
                color: 'white', border: 'none', borderRadius: 14,
                padding: '12px 20px', fontSize: 13, fontWeight: 800,
                cursor: 'pointer', boxShadow: '0 6px 20px rgba(255, 0, 128, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={16} />
              <span>Novo Modelo ({selectedAnoLetivo})</span>
            </button>

            <button
              onClick={() => setShowRestoreModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s ease'
              }}
            >
              <RotateCcw size={15} />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        {/* ── BARRA DE SELEÇÃO DE ANO LETIVO (PILLS) ── */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={14} color="#00d2ff" />
              Ano Letivo:
            </span>

            {anosDisponiveis.map(ano => {
              const isActive = selectedAnoLetivo === ano
              const count = templates.filter(t => (t.anoLetivo || '2026') === ano).length
              return (
                <button
                  key={ano}
                  onClick={() => {
                    setSelectedAnoLetivo(ano)
                    setSelectedSegment('Todos')
                    showToast(`Visualizando Ano Letivo ${ano}`)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isActive ? '#00d2ff' : 'rgba(255,255,255,0.06)',
                    color: isActive ? '#04101e' : 'rgba(255,255,255,0.7)',
                    border: isActive ? '1px solid #00d2ff' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 800,
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: isActive ? '0 4px 14px rgba(0, 210, 255, 0.4)' : 'none'
                  }}
                >
                  <span>{ano}</span>
                  {ano === anoVigente && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 6,
                      background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: isActive ? '#04101e' : '#10b981', fontWeight: 800
                    }}>
                      Vigente
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 10,
                    background: isActive ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)',
                    color: isActive ? '#04101e' : 'rgba(255,255,255,0.5)', fontWeight: 800
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
            {templatesDoAno.length} modelo(s) para {selectedAnoLetivo}
          </div>
        </div>
      </div>

      {/* ─── 2. CENTRAL DE DESTINATÁRIO & PERSONALIZAÇÃO ─── */}
      <div
        style={{
          background: 'hsl(var(--bg-surface))',
          borderRadius: 20,
          padding: '24px',
          border: '1px solid hsl(var(--border-subtle))',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column', gap: 16
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 14, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <Smartphone size={18} />
            </div>
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif' }}>
                Central de Destinatário & Personalização
              </span>
              <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                Selecione um aluno/responsável da escola ou digite um telefone avulso para preencher o WhatsApp.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            Variáveis: <code style={{ background: 'hsl(var(--bg-elevated))', padding: '2px 6px', borderRadius: 6, color: '#10b981', border: '1px solid hsl(var(--border-subtle))' }}>{'{nome_responsavel}'}</code>, <code style={{ background: 'hsl(var(--bg-elevated))', padding: '2px 6px', borderRadius: 6, color: '#3b82f6', border: '1px solid hsl(var(--border-subtle))' }}>{'{ano_letivo}'}: {selectedAnoLetivo}</code>
          </div>
        </div>

        {/* Inputs de Destinatário */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          
          {/* Input 1: Busca de Aluno / Responsável na Base */}
          <div ref={searchContainerRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Buscar Aluno / Responsável na Base
            </label>
            <div style={{ position: 'relative' }}>
              {isSearchingStudents ? (
                <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
              ) : (
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              )}
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value)
                  setIsStudentDropdownOpen(true)
                }}
                onFocus={() => {
                  if (studentSearchResults.length > 0 || studentSearchQuery.trim().length >= 2) {
                    setIsStudentDropdownOpen(true)
                  }
                }}
                placeholder="Ex: Nome do aluno ou responsável..."
                style={{
                  width: '100%',
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-default))',
                  borderRadius: 12,
                  padding: '10px 34px 10px 36px',
                  fontSize: 13,
                  color: 'hsl(var(--text-primary))',
                  outline: 'none',
                  fontWeight: 600
                }}
              />
              {studentSearchQuery && (
                <button
                  onClick={() => {
                    setStudentSearchQuery('')
                    setRecipientName('')
                    setStudentName('')
                    setRecipientPhone('')
                    setStudentSearchResults([])
                    setIsStudentDropdownOpen(false)
                  }}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown de Alunos / Responsáveis Encontrados */}
            <AnimatePresence>
              {isStudentDropdownOpen && studentSearchQuery.trim().length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  style={{
                    position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)',
                    zIndex: 50,
                    background: 'hsl(var(--bg-surface))',
                    border: '1px solid hsl(var(--border-default))',
                    borderRadius: 14,
                    boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                    maxHeight: 320,
                    overflowY: 'auto'
                  }}
                >
                  {isSearchingStudents ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Buscando no banco de dados...</span>
                    </div>
                  ) : studentSearchResults.length > 0 ? (
                    studentSearchResults.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectStudentAndGuardian(item)}
                        style={{
                          padding: '12px 14px',
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', gap: 6,
                          borderBottom: '1px solid hsl(var(--border-subtle))',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.nomeAluno || (item.responsaveis[0]?.nome ? `Responsável: ${item.responsaveis[0]?.nome}` : 'Cadastro')}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 6,
                              background: item.origem === 'aluno' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: item.origem === 'aluno' ? '#3b82f6' : '#10b981'
                            }}>
                              {item.origem === 'aluno' ? 'Aluno' : 'Responsável'}
                            </span>
                          </div>

                          {item.turma && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                              {item.turma}
                            </span>
                          )}
                        </div>

                        {/* Lista de Responsáveis Vinculados ao Aluno */}
                        {item.responsaveis.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                            <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                              {item.responsaveis.length > 1 ? `Escolher Responsável (${item.responsaveis.length}):` : 'Responsável:'}
                            </span>
                            {item.responsaveis.map(resp => (
                              <button
                                key={resp.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSelectStudentAndGuardian(item, resp)
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontSize: 11, padding: '3px 8px', borderRadius: 8,
                                  background: 'hsl(var(--bg-surface))',
                                  border: '1px solid hsl(var(--border-default))',
                                  color: 'hsl(var(--text-primary))',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor = '#10b981'
                                  e.currentTarget.style.color = '#10b981'
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor = 'hsl(var(--border-default))'
                                  e.currentTarget.style.color = 'hsl(var(--text-primary))'
                                }}
                              >
                                <strong style={{ color: '#10b981' }}>{resp.tipo}:</strong> {resp.nome}
                                {resp.telefone && <span style={{ opacity: 0.6, fontSize: 10 }}>({formatPhoneNumber(resp.telefone)})</span>}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                            Nenhum responsável cadastrado neste perfil.
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 12 }}>
                      Nenhum aluno ou responsável encontrado para "{studentSearchQuery}".
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input 2: Nome do Responsável */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Nome do Responsável
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ex: Maria Rossi"
                style={{
                  width: '100%',
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-default))',
                  borderRadius: 12,
                  padding: '10px 14px 10px 36px',
                  fontSize: 13,
                  color: 'hsl(var(--text-primary))',
                  outline: 'none',
                  fontWeight: 600
                }}
              />
            </div>
          </div>

          {/* Input 3: WhatsApp com DDD */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              WhatsApp com DDD
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
              <input
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(formatPhoneNumber(e.target.value))}
                placeholder="Ex: (11) 98765-4321"
                style={{
                  width: '100%',
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-default))',
                  borderRadius: 12,
                  padding: '10px 14px 10px 36px',
                  fontSize: 13,
                  color: 'hsl(var(--text-primary))',
                  outline: 'none',
                  fontWeight: 700,
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>
        </div>

        {/* ── BARRA DE SELEÇÃO RÁPIDA DE RESPONSÁVEIS VINCULADOS ── */}
        {availableResponsaveis.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <Users size={15} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                  {studentName ? `${studentName} possui ${availableResponsaveis.length} responsáveis cadastrados` : `Múltiplos responsáveis cadastrados (${availableResponsaveis.length})`}
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                  Clique para alternar para qual responsável direcionar o WhatsApp:
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {availableResponsaveis.map(resp => {
                const isSelected = resp.id === selectedResponsavelId || resp.nome === recipientName
                return (
                  <button
                    key={resp.id}
                    type="button"
                    onClick={() => {
                      setSelectedResponsavelId(resp.id)
                      setRecipientName(resp.nome)
                      setRecipientPhone(formatPhoneNumber(resp.telefone))
                      showToast(`Destinatário alterado para: ${resp.nome} (${resp.tipo}) 👤`)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #10b981' : '1px solid hsl(var(--border-default))',
                      background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'hsl(var(--bg-surface))',
                      color: isSelected ? '#10b981' : 'hsl(var(--text-primary))',
                      boxShadow: isSelected ? '0 2px 8px rgba(16, 185, 129, 0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{resp.tipo}: <strong>{resp.nome}</strong></span>
                    {resp.telefone && (
                      <span style={{ fontSize: 10.5, opacity: 0.8, color: isSelected ? '#10b981' : 'hsl(var(--text-secondary))' }}>
                        • {formatPhoneNumber(resp.telefone)}
                      </span>
                    )}
                    {isSelected && <Check size={14} style={{ strokeWidth: 3 }} />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* ─── 3. BARRA DE SEGMENTOS & BUSCA ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        
        {/* Abas de Segmentos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
          {segmentos.map(seg => {
            const isSelected = selectedSegment === seg
            return (
              <button
                key={seg}
                onClick={() => setSelectedSegment(seg)}
                style={{
                  background: isSelected ? 'linear-gradient(135deg, #7928CA 0%, #FF0080 100%)' : 'hsl(var(--bg-surface))',
                  color: isSelected ? 'white' : 'hsl(var(--text-secondary))',
                  border: isSelected ? 'none' : '1px solid hsl(var(--border-subtle))',
                  borderRadius: 12,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 4px 14px rgba(121, 40, 202, 0.3)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {seg}
              </button>
            )
          })}
        </div>

        {/* Campo de Busca Rápida */}
        <div style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Filtrar (${selectedAnoLetivo})...`}
            style={{
              width: '100%',
              background: 'hsl(var(--bg-surface))',
              border: '1px solid hsl(var(--border-default))',
              borderRadius: 12,
              padding: '8px 14px 8px 34px',
              fontSize: 12.5,
              color: 'hsl(var(--text-primary))',
              outline: 'none',
              fontWeight: 600
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ─── 4. GRID DE CARDS DE MENSAGENS WHATSAPP ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {filteredTemplates.map(tpl => {
          const isCopied = copiedId === tpl.id
          return (
            <div
              key={tpl.id}
              style={{
                background: 'hsl(var(--bg-surface))',
                borderRadius: 20,
                border: '1px solid hsl(var(--border-subtle))',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Card Header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                      background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.2)', padding: '2px 8px', borderRadius: 6
                    }}>
                      {tpl.segmento}
                    </span>

                    <span style={{
                      fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace',
                      background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899',
                      border: '1px solid rgba(236, 72, 153, 0.2)', padding: '2px 8px', borderRadius: 6
                    }}>
                      {tpl.atalho}
                    </span>

                    <span style={{
                      fontSize: 10.5, fontWeight: 800,
                      background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: 6
                    }}>
                      {tpl.anoLetivo || selectedAnoLetivo}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                    {tpl.titulo}
                  </h3>
                </div>

                {/* Ações de Edição do Card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => handleDuplicateTemplate(tpl)}
                    title="Duplicar"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'hsl(var(--text-muted))' }}
                  >
                    <Layers size={15} />
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(tpl)}
                    title="Editar"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'hsl(var(--text-muted))' }}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id, tpl.titulo)}
                    title="Excluir"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#ef4444' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* ── BALÃO SIMULADOR DO WHATSAPP (AUTÊNTICO) ── */}
              <div style={{
                padding: '20px',
                background: 'linear-gradient(180deg, #0b141a 0%, #080f14 100%)',
                flex: 1,
                borderBottom: '1px solid hsl(var(--border-subtle))'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #005c4b 0%, #025144 100%)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  color: 'white',
                  maxWidth: '100%'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={13} color="#34d399" />
                      Visualização Formatada WhatsApp
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10 }}>
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </span>
                  </div>

                  <div style={{ maxHeight: 280, overflowY: 'auto' }} className="no-scrollbar">
                    {renderFormattedWhatsAppPreview(tpl.conteudo)}
                  </div>
                </div>
              </div>

              {/* Card Footer com Botões de Ação */}
              <div style={{ padding: '14px 20px', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  {recipientPhone ? (
                    <span>Destino: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{recipientPhone}</strong></span>
                  ) : (
                    <span>Sem destinatário direto</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Botão Copiar */}
                  <button
                    onClick={() => handleCopy(tpl)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: isCopied ? '#10b981' : 'hsl(var(--bg-surface))',
                      color: isCopied ? 'white' : 'hsl(var(--text-primary))',
                      border: '1px solid hsl(var(--border-default))',
                      borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                  </button>

                  {/* Botão Enviar WhatsApp */}
                  <button
                    onClick={() => handleSendWhatsApp(tpl)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white', border: 'none',
                      borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 800,
                      cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Send size={14} />
                    <span>Disparar WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── CASO VAZIO (SEM MODELOS NO ANO) ─── */}
      {filteredTemplates.length === 0 && (
        <div style={{
          background: 'hsl(var(--bg-surface))',
          borderRadius: 24,
          padding: '48px 24px',
          textAlign: 'center',
          border: '1px solid hsl(var(--border-subtle))',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14
        }}>
          <HelpCircle size={40} color="hsl(var(--text-muted))" />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>
            Nenhum modelo para o Ano Letivo {selectedAnoLetivo}
          </h3>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', margin: 0, maxWidth: 450 }}>
            Não foram encontrados textos cadastrados para o ano letivo selecionado com os filtros atuais.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {selectedAnoLetivo !== '2026' && (
              <button
                onClick={handleCloneTemplatesToCurrentYear}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white', border: 'none', borderRadius: 12,
                  padding: '10px 18px', fontSize: 12.5, fontWeight: 800,
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                <CopyPlus size={15} />
                <span>Clonar Modelos de 2026 para {selectedAnoLetivo}</span>
              </button>
            )}

            <button
              onClick={handleOpenCreateModal}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#7928ca', color: 'white', border: 'none',
                borderRadius: 12, padding: '10px 18px', fontSize: 12.5, fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <Plus size={15} />
              <span>Criar Modelo para {selectedAnoLetivo}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: CRIAR OU EDITAR MODELO ─── */}
      <AnimatePresence>
        {activeEditorModal.isOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-default))',
                borderRadius: 24,
                padding: '28px',
                maxWidth: 750,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column', gap: 20
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(121, 40, 202, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7928ca' }}>
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                      {activeEditorModal.mode === 'create' ? 'Novo Modelo de Mensagem' : 'Editar Modelo'}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                      Configure título, segmento, valores e texto formatado.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveEditorModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  
                  {/* Título */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 6 }}>
                      Título do Modelo
                    </label>
                    <input
                      type="text"
                      value={activeEditorModal.template.titulo}
                      onChange={(e) => setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, titulo: e.target.value } }))}
                      placeholder="Ex: Villa Baby – Nível 1 e 2"
                      style={{
                        width: '100%', background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-default))', borderRadius: 10,
                        padding: '10px 14px', fontSize: 13, color: 'hsl(var(--text-primary))', outline: 'none', fontWeight: 600
                      }}
                    />
                  </div>

                  {/* Ano Letivo */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 6 }}>
                      Ano Letivo
                    </label>
                    <input
                      type="text"
                      value={activeEditorModal.template.anoLetivo || selectedAnoLetivo}
                      onChange={(e) => setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, anoLetivo: e.target.value } }))}
                      placeholder="Ex: 2026"
                      style={{
                        width: '100%', background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-default))', borderRadius: 10,
                        padding: '10px 14px', fontSize: 13, color: 'hsl(var(--text-primary))', outline: 'none', fontWeight: 800
                      }}
                    />
                  </div>

                  {/* Segmento */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 6 }}>
                      Segmento / Categoria
                    </label>
                    <input
                      type="text"
                      value={activeEditorModal.template.segmento}
                      onChange={(e) => setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, segmento: e.target.value } }))}
                      placeholder="Ex: Villa Baby, Ed. Infantil"
                      style={{
                        width: '100%', background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-default))', borderRadius: 10,
                        padding: '10px 14px', fontSize: 13, color: 'hsl(var(--text-primary))', outline: 'none', fontWeight: 600
                      }}
                    />
                  </div>

                  {/* Atalho */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 6 }}>
                      Código / Atalho (ex: /baby)
                    </label>
                    <input
                      type="text"
                      value={activeEditorModal.template.atalho}
                      onChange={(e) => setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, atalho: e.target.value } }))}
                      placeholder="Ex: /baby"
                      style={{
                        width: '100%', background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-default))', borderRadius: 10,
                        padding: '10px 14px', fontSize: 13, color: '#ec4899', outline: 'none', fontWeight: 700, fontFamily: 'monospace'
                      }}
                    />
                  </div>
                </div>

                {/* Toolbar de Formatação */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>
                      Texto Formatado WhatsApp
                    </label>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>*negrito*, _itálico_, emojis</span>
                  </div>

                  {/* Botões de Atalhos */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = activeEditorModal.template.conteudo
                        setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, conteudo: cur + ' *texto*' } }))
                      }}
                      style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'hsl(var(--text-primary))' }}
                    >
                      *Negrito*
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const cur = activeEditorModal.template.conteudo
                        setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, conteudo: cur + ' _texto_' } }))
                      }}
                      style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontStyle: 'italic', cursor: 'pointer', color: 'hsl(var(--text-primary))' }}
                    >
                      _Itálico_
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const cur = activeEditorModal.template.conteudo
                        setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, conteudo: cur + ' {nome_responsavel}' } }))
                      }}
                      style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#3b82f6', fontFamily: 'monospace' }}
                    >
                      +{'{nome_responsavel}'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const cur = activeEditorModal.template.conteudo
                        setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, conteudo: cur + ' {ano_letivo}' } }))
                      }}
                      style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#f59e0b', fontFamily: 'monospace' }}
                    >
                      +{'{ano_letivo}'}
                    </button>

                    {['✨', '📚', '🗂', '💳', '🏫', '🍎', '💰', '📅'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          const cur = activeEditorModal.template.conteudo
                          setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, conteudo: cur + ` ${emoji}` } }))
                        }}
                        style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={10}
                    value={activeEditorModal.template.conteudo}
                    onChange={(e) => setActiveEditorModal(prev => ({ ...prev, template: { ...prev.template, conteudo: e.target.value } }))}
                    placeholder="Digite ou cole aqui o texto com formatações de WhatsApp..."
                    style={{
                      width: '100%',
                      background: 'hsl(var(--bg-elevated))',
                      border: '1px solid hsl(var(--border-default))',
                      borderRadius: 14,
                      padding: '14px',
                      fontSize: 13,
                      color: 'hsl(var(--text-primary))',
                      outline: 'none',
                      lineHeight: 1.6,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                <button
                  type="button"
                  onClick={() => setActiveEditorModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    background: 'transparent', border: '1px solid hsl(var(--border-default))',
                    borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 700,
                    color: 'hsl(var(--text-secondary))', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveModalTemplate}
                  style={{
                    background: 'linear-gradient(135deg, #7928CA 0%, #FF0080 100%)',
                    color: 'white', border: 'none', borderRadius: 12,
                    padding: '10px 22px', fontSize: 13, fontWeight: 800,
                    cursor: 'pointer', boxShadow: '0 4px 15px rgba(121, 40, 202, 0.35)'
                  }}
                >
                  Salvar Modelo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL DE CONFIRMAÇÃO: RESTAURAR PADRÕES ─── */}
      <AnimatePresence>
        {showRestoreModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-default))',
                borderRadius: 20, padding: '24px', maxWidth: 440, width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column', gap: 14
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f59e0b' }}>
                <RotateCcw size={22} />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>
                  Restaurar Modelos Originais?
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                Isso recarregará os textos padrões fornecidos de 2026 (Villa Baby, Ed. Infantil, Fundamental, etc.). Qualquer modelo customizado poderá ser substituído.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  onClick={() => setShowRestoreModal(false)}
                  style={{
                    background: 'transparent', border: '1px solid hsl(var(--border-default))',
                    borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 700,
                    color: 'hsl(var(--text-secondary))', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRestoreDefaults}
                  style={{
                    background: '#f59e0b', color: '#000', border: 'none',
                    borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Sim, Restaurar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
