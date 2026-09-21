'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'
import { toast } from 'sonner'
import {
  FileCheck2, ShieldCheck, Plus, Search, RefreshCw, Filter,
  ExternalLink, Copy, Check, MessageSquare, Mail, Download,
  Eye, EyeOff, Trash2, X, AlertCircle, CheckCircle2, Clock, Smartphone,
  Building2, User, Users, Calendar, PenTool, Lock,
  Fingerprint, ChevronRight, Settings, Upload, FileText, CheckSquare,
  Loader2, BadgeCheck, Image as ImageIcon, Activity, Send, Ban, Sparkles,
  MoreHorizontal, School, GraduationCap, ChevronDown, ArrowUp, ArrowDown,
  Layers, Files, FilePlus2
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { SmtpDiagnosticModal } from '@/components/matriculas/SmtpDiagnosticModal'
import { DigitalPagination, LimitePorPagina } from '@/components/matriculas/DigitalPagination'
import { getWhatsAppShareUrl, DEFAULT_WHATSAPP_DIGITAL_TEMPLATE, formatarMensagemWhatsApp } from '@/lib/whatsapp'
import {
  processarDocumentoParaPdf,
  processarArquivosEmLote,
  mesclarMultiplosDocumentosPdf,
  DocumentoUploadItem,
  formatBytes,
} from '@/lib/converters/documentToPdfClient'

export interface RepresentanteConfigItem {
  id: string
  nome: string
  cpf: string
  cargo: string
  razaoSocial: string
  cnpj: string
  email?: string
  telefone?: string
  endereco?: string
  cidadeUf?: string
  segmento?: string
  padrao?: boolean
}

interface ContratoItem {
  id: string
  protocolo: string
  token_assinatura: string
  aluno_id: string
  aluno_nome: string
  aluno_cpf?: string | null
  aluno_turma?: string | null
  aluno_serie?: string | null
  responsavel_nome: string
  responsavel_cpf: string
  responsavel_email: string
  responsavel_telefone: string
  responsavel_parentesco?: string | null
  ano_letivo: string
  tipo_documento: string
  titulo_documento: string
  status: 'rascunho' | 'pendente' | 'assinado' | 'recusado' | 'cancelado'
  documento_original_hash: string
  documento_assinado_hash?: string | null
  documento_pdf_base64?: string | null
  documento_assinado_pdf_base64?: string | null
  otp_confirmado_em?: string | null
  otp_codigo_aberto?: string | null
  evidencias?: any
  historico_eventos?: Array<{
    timestamp: string
    evento: string
    descricao: string
    ip: string
    hash: string
  }>
  created_at: string
  updated_at: string
}

interface Metrics {
  total: number
  pendentes: number
  assinados: number
  cancelados: number
  taxaAssinatura: number
  integridadePercentual: number
}

interface ResponsavelOption {
  id?: string
  tipo: string
  nome: string
  cpf: string
  email: string
  telefone: string
  isFinanceiro?: boolean
  isPedagogico?: boolean
  dataNascimento?: string
}

const AUTORIZACOES_PADRAO = [
  'Ciência integral das normas e Regimento Escolar do Colégio Impacto',
  'Autorização de uso de imagem e voz para fins pedagógicos e institucionais',
  'Autorização de saídas pedagógicas e visitas de estudo programadas',
  'Declaração de veracidade das informações e documentos apresentados',
]

export default function MatriculaDigitalPage() {
  const { alunos = [], turmas = [], cfgCalendarioLetivo = [] } = useData() as any

  // Resolve o nome legível da turma (ex: "4º ANO A - MATUTINO") a partir do ID, código ou objeto do aluno
  const getNomeTurma = (alunoOuTurma: any): string => {
    if (!alunoOuTurma) return 'Regular'

    // Se for um objeto aluno
    if (typeof alunoOuTurma === 'object') {
      if (alunoOuTurma.turma_nome && isNaN(Number(alunoOuTurma.turma_nome))) {
        return String(alunoOuTurma.turma_nome).trim()
      }
      if (typeof alunoOuTurma.turma === 'string' && alunoOuTurma.turma && isNaN(Number(alunoOuTurma.turma))) {
        return String(alunoOuTurma.turma).trim()
      }

      const raw = alunoOuTurma.turma || alunoOuTurma.turma_id || alunoOuTurma.serieTurma || ''
      const rawStr = String(raw).trim()

      if (Array.isArray(turmas) && rawStr) {
        const found = turmas.find((t: any) =>
          String(t.id).trim() === rawStr ||
          (t.codigo && String(t.codigo).trim() === rawStr) ||
          (t.nome && String(t.nome).trim().toLowerCase() === rawStr.toLowerCase())
        )
        if (found?.nome) return String(found.nome).trim()
      }

      if (alunoOuTurma.dados?.turmaNome) return String(alunoOuTurma.dados.turmaNome).trim()
      if (alunoOuTurma.dados?.nomeTurma) return String(alunoOuTurma.dados.nomeTurma).trim()
      if (alunoOuTurma.serie && isNaN(Number(alunoOuTurma.serie))) return String(alunoOuTurma.serie).trim()

      return rawStr || alunoOuTurma.serie || 'Regular'
    }

    // Se for ID ou string direta
    const rawStr = String(alunoOuTurma).trim()
    if (Array.isArray(turmas) && rawStr) {
      const found = turmas.find((t: any) =>
        String(t.id).trim() === rawStr ||
        (t.codigo && String(t.codigo).trim() === rawStr) ||
        (t.nome && String(t.nome).trim().toLowerCase() === rawStr.toLowerCase())
      )
      if (found?.nome) return String(found.nome).trim()
    }

    return rawStr || 'Regular'
  }

  // Determina com inteligência o ano letivo inicial da campanha de matrícula:
  // No 2º semestre do ano civil (julho em diante), a campanha de matrículas visa o ano subsequente (ex: 2027 em 2026).
  const anoPadraoInicial = useMemo(() => {
    const d = new Date()
    return d.getMonth() >= 6 ? String(d.getFullYear() + 1) : String(d.getFullYear())
  }, [])

  // Estados de listagem e filtros
  const [contratos, setContratos] = useState<ContratoItem[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0,
    pendentes: 0,
    assinados: 0,
    cancelados: 0,
    taxaAssinatura: 0,
    integridadePercentual: 100,
  })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [anoFiltro, setAnoFiltro] = useState<string>(anoPadraoInicial)
  const [busca, setBusca] = useState('')
  const [anosConfig, setAnosConfig] = useState<string[]>([])
  const [ultimoAnoConfig, setUltimoAnoConfig] = useState<string>('')
  const anoAlteradoManualmenteRef = useRef(false)
  const activeFetchControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef<number>(0)

  // ── Paginação Ultra Moderna (padrão sempre 30, 50, 100 ou 'tudo') ──
  const [limitePorPagina, setLimitePorPagina] = useState<LimitePorPagina>(30)
  const [paginaAtual, setPaginaAtual] = useState<number>(1)
  const tabelaRef = useRef<HTMLDivElement>(null)

  const handleMudarLimite = (novoLimite: LimitePorPagina) => {
    setLimitePorPagina(novoLimite)
    setPaginaAtual(1)
  }

  const handleMudarPagina = (novaPagina: number) => {
    setPaginaAtual(novaPagina)
    if (tabelaRef.current) {
      tabelaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Lista fatiada para a página e limite selecionados
  const contratosPaginados = useMemo(() => {
    if (limitePorPagina === 'tudo') return contratos
    const pageSize = Number(limitePorPagina)
    const inicio = (paginaAtual - 1) * pageSize
    return contratos.slice(inicio, inicio + pageSize)
  }, [contratos, paginaAtual, limitePorPagina])

  // Ajusta automaticamente a página caso a quantidade de itens diminua
  useEffect(() => {
    if (limitePorPagina === 'tudo') return
    const pageSize = Number(limitePorPagina)
    const maxPaginas = Math.ceil(contratos.length / pageSize) || 1
    if (paginaAtual > maxPaginas) {
      setPaginaAtual(1)
    }
  }, [contratos.length, limitePorPagina, paginaAtual])

  // Reseta para a primeira página ao alterar filtros de busca, ano ou status
  useEffect(() => {
    setPaginaAtual(1)
  }, [statusFiltro, anoFiltro, busca])

  // ── ANOS LETIVOS CADASTRADOS NO SISTEMA ──
  const anosLetivosDisponiveis = useMemo(() => {
    const anos = new Set<string>()

    // 0. Anos cadastrados nas configurações do sistema (via API direta)
    if (Array.isArray(anosConfig)) {
      anosConfig.forEach(a => {
        const val = String(a || '').trim()
        if (val) anos.add(val)
      })
    }

    // 1. Cadastrados no módulo de Configurações Pedagógicas -> Ano Letivo (cfgCalendarioLetivo)
    if (Array.isArray(cfgCalendarioLetivo)) {
      cfgCalendarioLetivo.forEach((c: any) => {
        if (c && c.ano) {
          const a = String(c.ano).trim()
          if (a) anos.add(a)
        }
      })
    }

    // 2. Anos cadastrados nas Turmas do ERP
    if (Array.isArray(turmas)) {
      turmas.forEach((t: any) => {
        if (t.ano) anos.add(String(t.ano).trim())
        if (t.ano_letivo) anos.add(String(t.ano_letivo).trim())
        if (t.dados?.anoLetivo) anos.add(String(t.dados.anoLetivo).trim())
      })
    }

    // 3. Anos já presentes em contratos emitidos
    if (Array.isArray(contratos)) {
      contratos.forEach(c => {
        if (c.ano_letivo) {
          const a = String(c.ano_letivo).trim()
          if (a && a !== 'todos') anos.add(a)
        }
      })
    }

    // Fallback: se não houver nenhum, usa o ano padrão inicial da campanha (ex: 2027)
    if (anos.size === 0) {
      anos.add(anoPadraoInicial)
    }

    // Ordenação decrescente: o ano mais recente/maior no topo (ex: 2028, 2027, 2026...)
    return Array.from(anos).sort((a, b) => Number(b) - Number(a))
  }, [anosConfig, cfgCalendarioLetivo, turmas, contratos, anoPadraoInicial])

  // Obtém sempre o último ano cadastrado no sistema
  const ultimoAnoCadastrado = useMemo(() => {
    // 0. Prioridade se já carregado das configurações diretas
    if (ultimoAnoConfig) {
      return ultimoAnoConfig
    }

    // 1. Prioridade para cfgCalendarioLetivo (último cadastrado por criadoEm ou ordem)
    if (Array.isArray(cfgCalendarioLetivo) && cfgCalendarioLetivo.length > 0) {
      const validos = cfgCalendarioLetivo
        .filter((c: any) => c && c.ano)
        .map((c: any) => ({
          ano: String(c.ano).trim(),
          criadoEm: c.criadoEm || c.createdAt || '',
        }))

      if (validos.length > 0) {
        const ordenados = [...validos].sort((a, b) => {
          const timeA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0
          const timeB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0
          if (timeA !== timeB) return timeB - timeA
          return Number(b.ano) - Number(a.ano)
        })
        return ordenados[0].ano
      }
    }

    // 2. Fallback: Primeiro ano da lista de disponíveis (maior ano)
    if (anosLetivosDisponiveis.length > 0) {
      return anosLetivosDisponiveis[0]
    }

    return anoPadraoInicial
  }, [ultimoAnoConfig, cfgCalendarioLetivo, anosLetivosDisponiveis, anoPadraoInicial])

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [modalAuditoriaContrato, setModalAuditoriaContrato] = useState<ContratoItem | null>(null)
  const [modalConfigAberto, setModalConfigAberto] = useState(false)
  const [modalVerificadorAberto, setModalVerificadorAberto] = useState(false)

  // Estados de Upload de Documentos (suporte a seleção e envio de múltiplos arquivos)
  const [documentosUpload, setDocumentosUpload] = useState<DocumentoUploadItem[]>([])
  const [modoEnvioMultiplo, setModoEnvioMultiplo] = useState<'unificado' | 'separados'>('unificado')
  const [docPreviaAtivo, setDocPreviaAtivo] = useState<DocumentoUploadItem | null>(null)
  const [previaEhPacoteUnificado, setPreviaEhPacoteUnificado] = useState<boolean>(false)
  const [pdfUnificadoPreview, setPdfUnificadoPreview] = useState<{
    pdfBase64: string
    cleanBase64: string
    nomeArquivoPdf: string
    tamanhoFormatado: string
    totalPaginas: number
  } | null>(null)
  const [gerandoPreviaPacote, setGerandoPreviaPacote] = useState<boolean>(false)
  const [convertendoDocumento, setConvertendoDocumento] = useState<boolean>(false)
  const [statusConversao, setStatusConversao] = useState<string>('')
  const [modalPreviaPdfAberto, setModalPreviaPdfAberto] = useState<boolean>(false)
  const [arrastandoArquivo, setArrastandoArquivo] = useState<boolean>(false)

  // Propriedades derivadas para compatibilidade e pré-visualização
  const documentoPrincipal = documentosUpload[0] || null
  const totalPaginasGeral = useMemo(() => {
    return documentosUpload.reduce((acc, d) => acc + (d.totalPaginas || 1), 0)
  }, [documentosUpload])
  const totalBytesGeral = useMemo(() => {
    return documentosUpload.reduce((acc, d) => acc + (d.tamanhoBytes || 0), 0)
  }, [documentosUpload])
  const totalTamanhoFormatadoGeral = useMemo(() => {
    return formatBytes(totalBytesGeral)
  }, [totalBytesGeral])

  // PDF ativo para exibição no modal de prévia (individual ou pacote unificado)
  const pdfPreviaAtivo = useMemo(() => {
    if (previaEhPacoteUnificado && pdfUnificadoPreview) {
      return {
        base64: pdfUnificadoPreview.pdfBase64,
        nome: pdfUnificadoPreview.nomeArquivoPdf,
        tamanho: pdfUnificadoPreview.tamanhoFormatado,
        paginas: pdfUnificadoPreview.totalPaginas,
        formato: 'pdf' as const,
        isPacote: true,
      }
    }
    if (docPreviaAtivo) {
      return {
        base64: docPreviaAtivo.pdfBase64,
        nome: docPreviaAtivo.nome,
        tamanho: docPreviaAtivo.tamanhoFormatado,
        paginas: docPreviaAtivo.totalPaginas,
        formato: docPreviaAtivo.formatoOriginal,
        isPacote: false,
      }
    }
    if (documentoPrincipal) {
      return {
        base64: documentoPrincipal.pdfBase64,
        nome: documentoPrincipal.nome,
        tamanho: documentoPrincipal.tamanhoFormatado,
        paginas: documentoPrincipal.totalPaginas,
        formato: documentoPrincipal.formatoOriginal,
        isPacote: false,
      }
    }
    return null
  }, [previaEhPacoteUnificado, pdfUnificadoPreview, docPreviaAtivo, documentoPrincipal])

  // Getters para compatibilidade com partes existentes
  const pdfUploadBase64 = pdfPreviaAtivo?.base64 || documentoPrincipal?.pdfBase64 || null
  const pdfUploadNome = pdfPreviaAtivo?.nome || documentoPrincipal?.nome || ''
  const pdfUploadTamanho = pdfPreviaAtivo?.tamanho || documentoPrincipal?.tamanhoFormatado || ''
  const formatoOriginalUpload = pdfPreviaAtivo?.formato || documentoPrincipal?.formatoOriginal || null

  // URL Blob para pré-visualização compatível com Safari no macOS/iOS (evita tela branca)
  const previewPdfBlobUrl = useMemo(() => {
    if (!pdfUploadBase64) return null
    try {
      const cleanB64 = pdfUploadBase64.replace(/^data:application\/pdf;base64,/, '')
      const byteCharacters = atob(cleanB64)
      const byteNumbers = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([byteNumbers], { type: 'application/pdf' })
      return URL.createObjectURL(blob)
    } catch {
      return pdfUploadBase64
    }
  }, [pdfUploadBase64])

  // Estados do Modal de Envio & Seleção de Signatário
  const [buscaAlunoInput, setBuscaAlunoInput] = useState('')
  const [alunosSugeridos, setAlunosSugeridos] = useState<any[]>([])
  const [buscandoAlunos, setBuscandoAlunos] = useState(false)
  const [dropdownAlunosAberto, setDropdownAlunosAberto] = useState(false)
  const [alunoSelecionado, setAlunoSelecionado] = useState<any | null>(null)
  const [responsaveisDisponiveis, setResponsaveisDisponiveis] = useState<ResponsavelOption[]>([])
  const [carregandoResponsaveis, setCarregandoResponsaveis] = useState(false)
  const [responsavelSelecionadoId, setResponsavelSelecionadoId] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const clientSearchCacheRef = useRef<Map<string, any[]>>(new Map())
  const searchAbortControllerRef = useRef<AbortController | null>(null)

  const DEFAULT_REPRESENTANTES_INICIAIS: RepresentanteConfigItem[] = [
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
      segmento: 'Ed. Infantil e Ens. Fund',
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
      segmento: 'Ens. Médio',
      padrao: false,
    },
  ]

  const [formNovo, setFormNovo] = useState({
    aluno_id: '',
    aluno_nome: '',
    titulo_documento: '',
    escola_representante_id: 'rep_infantil_fundamental',
    signatario_nome: '',
    signatario_cpf: '',
    signatario_data_nascimento: '',
    signatario_email: '',
    signatario_telefone: '',
    signatario_cargo: 'Responsável',
    ano_letivo: anoPadraoInicial,
  })

  // Sincroniza o ano selecionado com o último ano cadastrado no sistema
  useEffect(() => {
    if (ultimoAnoCadastrado && !anoAlteradoManualmenteRef.current) {
      setAnoFiltro(prev => (prev === ultimoAnoCadastrado ? prev : ultimoAnoCadastrado))
      setFormNovo(prev => ({
        ...prev,
        ano_letivo: prev.ano_letivo || ultimoAnoCadastrado,
      }))
    }
  }, [ultimoAnoCadastrado])
  const [salvandoContrato, setSalvandoContrato] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [baixandoPdfId, setBaixandoPdfId] = useState<string | null>(null)
  const [contratoCriadoSucesso, setContratoCriadoSucesso] = useState<{
    contrato: ContratoItem
    signUrl: string
    validationUrl: string
    whatsappText: string
    whatsappShareUrl: string
    modo_envio?: 'unificado' | 'separados'
    total?: number
    totalDocumentos?: number
    itens?: Array<{
      contrato: ContratoItem
      signUrl: string
      validationUrl: string
      whatsappText: string
      whatsappShareUrl: string
    }>
  } | null>(null)
  const [copiadoModalLink, setCopiadoModalLink] = useState(false)
  const [copiadoProtocoloId, setCopiadoProtocoloId] = useState<string | null>(null)
  const [copiadoTokenLink, setCopiadoTokenLink] = useState<string | null>(null)

  // Estados de Configurações
  const [configData, setConfigData] = useState({
    representante: DEFAULT_REPRESENTANTES_INICIAIS[0],
    representantes: DEFAULT_REPRESENTANTES_INICIAIS,
    logoUrl: '/logo-impacto-clean.png',
    whatsappTemplate: DEFAULT_WHATSAPP_DIGITAL_TEMPLATE,
    smtp: {
      host: 'email-ssl.com.br',
      port: 465,
      secure: true,
      user: 'direcao@colegioimpacto.net',
      pass: '',
      from: 'direcao@colegioimpacto.net',
      ativo: false,
    },
  })
  const [repConfigIndex, setRepConfigIndex] = useState(0)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [mostrarSenhaSmtp, setMostrarSenhaSmtp] = useState(false)
  const [testandoSmtp, setTestandoSmtp] = useState(false)
  const [modalDiagnosticoAberto, setModalDiagnosticoAberto] = useState(false)
  const [modoDiagnostico, setModoDiagnostico] = useState<'test_connection' | 'send_test_email'>('test_connection')
  const [mostrarPreviaWhatsapp, setMostrarPreviaWhatsapp] = useState(true)
  const [telefoneTesteWhatsapp, setTelefoneTesteWhatsapp] = useState('(67) 99280-6464')

  const handleAbrirDiagnostico = (modo: 'test_connection' | 'send_test_email' = 'test_connection') => {
    setModoDiagnostico(modo)
    setModalDiagnosticoAberto(true)
  }

  // Estados do Verificador de Arquivo Local
  const [arquivoHashCalc, setArquivoHashCalc] = useState<string | null>(null)
  const [arquivoResultado, setArquivoResultado] = useState<any | null>(null)
  const [checandoArquivo, setChecandoArquivo] = useState(false)

  // Estados da Central de Validação de Contrato
  const [modalValidacaoAberto, setModalValidacaoAberto] = useState(false)
  const [validacaoProtocoloInput, setValidacaoProtocoloInput] = useState('')
  const [validandoProtocolo, setValidandoProtocolo] = useState(false)
  const [resultadoValidacaoModal, setResultadoValidacaoModal] = useState<any | null>(null)
  const [erroValidacaoModal, setErroValidacaoModal] = useState<string | null>(null)
  const [tabValidacao, setTabValidacao] = useState<'protocolo' | 'arquivo' | 'ajuda'>('protocolo')

  const handleValidarProtocoloNoModal = async (codigo?: string) => {
    const proto = (codigo || validacaoProtocoloInput).trim()
    if (!proto) {
      toast.error('Informe um protocolo ou token para validar.')
      return
    }
    setValidandoProtocolo(true)
    setErroValidacaoModal(null)
    setResultadoValidacaoModal(null)
    try {
      const res = await fetch(`/api/matriculas/digital/validar?protocolo=${encodeURIComponent(proto)}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.mensagem || data.error || 'Documento não localizado no banco oficial.')
      }
      setResultadoValidacaoModal(data)
    } catch (err: any) {
      setErroValidacaoModal(err.message || 'Erro ao consultar documento.')
    } finally {
      setValidandoProtocolo(false)
    }
  }

  // Carrega listagem de contratos com cancelamento de requisições obsoletas (AbortController) e anti-race condition
  const carregarContratos = async (overrideParams?: { status?: string; ano?: string; search?: string }) => {
    // 1. Cancela qualquer requisição anterior que ainda esteja trafegando na rede
    if (activeFetchControllerRef.current) {
      activeFetchControllerRef.current.abort()
    }
    const controller = new AbortController()
    activeFetchControllerRef.current = controller

    // 2. Incrementa e memoriza o identificador desta requisição
    const seq = ++requestSequenceRef.current
    setLoading(true)
    setFetchError(null)

    const statusParam = overrideParams?.status ?? statusFiltro
    const anoParam = overrideParams?.ano ?? anoFiltro
    const buscaParam = overrideParams?.search ?? busca

    const url = `/api/matriculas/digital?status=${encodeURIComponent(statusParam)}&ano=${encodeURIComponent(anoParam)}&search=${encodeURIComponent(buscaParam)}`

    const executeFetch = async (isRetry = false): Promise<any> => {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      })

      // Se ocorrer 401 transitório por concorrência de Web Lock na primeira chamada, aguarda 450ms e tenta novamente
      if (res.status === 401 && !isRetry) {
        await new Promise(r => setTimeout(r, 450))
        if (seq !== requestSequenceRef.current) return null
        return await executeFetch(true)
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || errJson.message || `Erro HTTP ${res.status} ao carregar contratos`)
      }

      return await res.json()
    }

    try {
      const data = await executeFetch()
      if (!data) return

      // Descarta o resultado se uma requisição mais recente já tiver sido disparada
      if (seq !== requestSequenceRef.current) {
        return
      }

      setContratos(data.contratos || [])
      setMetrics(data.metrics || {
        total: 0,
        pendentes: 0,
        assinados: 0,
        cancelados: 0,
        taxaAssinatura: 0,
        integridadePercentual: 100,
      })

      if (Array.isArray(data.anosCadastrados) && data.anosCadastrados.length > 0) {
        setAnosConfig(prev => Array.from(new Set([...prev, ...data.anosCadastrados])))
      }
      if (data.ultimoAnoCadastrado) {
        setUltimoAnoConfig(data.ultimoAnoCadastrado)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Requisição abortada porque uma mais recente foi despachada
        return
      }
      console.error('[Matricula Digital] Erro ao carregar contratos:', err)
      if (seq === requestSequenceRef.current) {
        setFetchError(err.message || 'Erro de conexão com o banco de dados.')
        toast.error('Erro ao buscar registros de matrículas digitais.')
      }
    } finally {
      if (seq === requestSequenceRef.current) {
        setLoading(false)
      }
    }
  }

  // Carrega configurações
  const carregarConfiguracoes = async () => {
    try {
      const res = await fetch('/api/matriculas/digital/configuracoes', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        if (data.ultimoAnoCadastrado) {
          setUltimoAnoConfig(data.ultimoAnoCadastrado)
          // Se o ano atual for diferente e o usuário não alterou manualmente, alinha suavemente
          if (!anoAlteradoManualmenteRef.current && (!anoFiltro || anoFiltro === '')) {
            setAnoFiltro(data.ultimoAnoCadastrado)
            setFormNovo(prev => ({
              ...prev,
              ano_letivo: data.ultimoAnoCadastrado,
            }))
          }
        }
        if (Array.isArray(data.anosLetivos) && data.anosLetivos.length > 0) {
          setAnosConfig(prev => Array.from(new Set([...prev, ...data.anosLetivos])))
        }

        setConfigData(prev => {
          const repsRaw = Array.isArray(data.representantes) && data.representantes.length > 0
            ? data.representantes
            : prev.representantes

          const reps = repsRaw.map((r: any) => {
            let seg = r.segmento
            if (seg === 'Educação Infantil e Ensino Fundamental' || seg === 'Educação Infantil e Fundamental') {
              seg = 'Ed. Infantil e Ens. Fund'
            } else if (seg === 'Ensino Médio') {
              seg = 'Ens. Médio'
            }
            return { ...r, segmento: seg }
          })
          return {
            representante: data.representante || reps[0] || prev.representante,
            representantes: reps,
            logoUrl: data.logoUrl || prev.logoUrl,
            whatsappTemplate: data.whatsappTemplate || prev.whatsappTemplate || DEFAULT_WHATSAPP_DIGITAL_TEMPLATE,
            smtp: {
              host: data.smtp?.host || 'email-ssl.com.br',
              port: Number(data.smtp?.port) || 465,
              secure: data.smtp?.secure !== undefined ? Boolean(data.smtp.secure) : true,
              user: data.smtp?.user || 'direcao@colegioimpacto.net',
              pass: data.smtp?.pass !== undefined ? data.smtp.pass : prev.smtp.pass,
              from: data.smtp?.fromEmail || data.smtp?.user || 'direcao@colegioimpacto.net',
              ativo: Boolean(data.smtp?.configurado),
            },
          }
        })
      }
    } catch (e) {
      console.error('Erro ao carregar configs:', e)
    }
  }

  useEffect(() => {
    carregarContratos()
  }, [statusFiltro, anoFiltro])

  useEffect(() => {
    carregarConfiguracoes()
  }, [])

  // Funções utilitárias de formatação
  const formatarCpf = (val: any): string => {
    if (!val) return ''
    const digits = String(val).replace(/\D/g, '').slice(0, 11)
    if (!digits) return ''
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }

  const formatarTelefone = (val: any): string => {
    if (!val) return ''
    const digits = String(val).replace(/\D/g, '').slice(0, 11)
    if (!digits) return ''
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
  }

  const formatarData = (val: any): string => {
    if (!val) return ''
    const digits = String(val).replace(/\D/g, '').slice(0, 8)
    if (!digits) return ''
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
  }

  // Busca dinâmica de alunos de alta performance via /api/alunos/search com cache e AbortController
  useEffect(() => {
    const termo = buscaAlunoInput.trim()
    if (!termo || alunoSelecionado) {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort()
        searchAbortControllerRef.current = null
      }
      setAlunosSugeridos([])
      setDropdownAlunosAberto(false)
      setBuscandoAlunos(false)
      return
    }

    // Se já estiver no cache local do cliente, exibe INSTANTANEAMENTE (0ms)
    const termoCacheKey = termo.toLowerCase()
    if (clientSearchCacheRef.current.has(termoCacheKey)) {
      const cached = clientSearchCacheRef.current.get(termoCacheKey) || []
      setAlunosSugeridos(cached)
      setDropdownAlunosAberto(cached.length > 0)
      setBuscandoAlunos(false)
      return
    }

    // Cancela qualquer requisição anterior em voo
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort()
    }
    const abortCtrl = new AbortController()
    searchAbortControllerRef.current = abortCtrl

    const timer = setTimeout(async () => {
      setBuscandoAlunos(true)
      try {
        const res = await fetch(`/api/alunos/search?q=${encodeURIComponent(termo)}&limit=8`, {
          signal: abortCtrl.signal,
        })
        if (res.ok) {
          const data = await res.json()
          const list = data.data || data.alunos || []
          clientSearchCacheRef.current.set(termoCacheKey, list)
          setAlunosSugeridos(list)
          setDropdownAlunosAberto(true)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Erro ao buscar alunos na API:', err)
        }
      } finally {
        if (!abortCtrl.signal.aborted) {
          setBuscandoAlunos(false)
        }
      }
    }, 120)

    return () => {
      clearTimeout(timer)
      abortCtrl.abort()
    }
  }, [buscaAlunoInput, alunoSelecionado])

  // Fecha o dropdown de alunos ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownAlunosAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Deduplicação e consolidação de responsáveis por nome/CPF
  const deduplicarResponsaveis = (list: ResponsavelOption[]): ResponsavelOption[] => {
    const unicos: ResponsavelOption[] = []

    for (const item of list) {
      if (!item.nome || !item.nome.trim()) continue

      const normNome = item.nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()

      const normCpf = item.cpf ? item.cpf.replace(/\D/g, '') : ''

      const index = unicos.findIndex(u => {
        const uNome = u.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
        const uCpf = u.cpf ? u.cpf.replace(/\D/g, '') : ''
        if (normCpf && uCpf && normCpf === uCpf) return true
        if (normNome === uNome) return true
        if (normNome.length > 5 && uNome.length > 5 && (normNome.startsWith(uNome) || uNome.startsWith(normNome))) return true
        return false
      })

      if (index >= 0) {
        const ex = unicos[index]
        unicos[index] = {
          ...ex,
          cpf: ex.cpf || item.cpf,
          email: ex.email || item.email,
          telefone: ex.telefone || item.telefone,
          tipo: (ex.tipo === 'Responsável' && item.tipo !== 'Responsável') ? item.tipo : ex.tipo,
          isFinanceiro: ex.isFinanceiro || item.isFinanceiro,
          isPedagogico: ex.isPedagogico || item.isPedagogico,
        }
      } else {
        unicos.push(item)
      }
    }

    return unicos
  }

  // Extração inicial de responsáveis a partir do objeto completo do aluno
  const extrairResponsaveisDoAluno = (aluno: any): ResponsavelOption[] => {
    const list: ResponsavelOption[] = []
    const d = aluno.dados || {}

    // Array de responsáveis já embutido no aluno (se existir)
    const embedded = [
      ...(Array.isArray(aluno.responsaveis) ? aluno.responsaveis : []),
      ...(Array.isArray(d.responsaveis) ? d.responsaveis : []),
    ]
    embedded.forEach((r: any, idx: number) => {
      const nome = typeof r === 'string' ? r : r.nome
      if (!nome) return
      list.push({
        id: r.id ? String(r.id) : `emb-${idx}`,
        nome: nome.trim(),
        tipo: r.parentesco || (r.isFinanceiro ? 'Resp. Financeiro' : r.isPedagogico ? 'Resp. Pedagógico' : 'Responsável'),
        cpf: formatarCpf(r.cpf || r.cpf_cnpj || ''),
        email: r.email || '',
        telefone: formatarTelefone(r.telefone || r.celular || ''),
        dataNascimento: r.data_nascimento || r.dataNascimento ? formatarData(r.data_nascimento || r.dataNascimento) : '',
        isFinanceiro: Boolean(r.isFinanceiro || r.resp_financeiro),
        isPedagogico: Boolean(r.isPedagogico || r.resp_pedagogico),
      })
    })

    // Dados da Mãe
    const maeNome = d.maeNome || d.nomeMae || aluno.mae
    if (maeNome && typeof maeNome === 'string' && maeNome.trim()) {
      list.push({
        id: 'mae',
        tipo: 'Mãe',
        nome: maeNome.trim(),
        cpf: formatarCpf(d.maeCpf || d.cpfMae || ''),
        email: d.maeEmail || d.emailMae || '',
        telefone: formatarTelefone(d.maeTelefone || d.telefoneMae || d.celularMae || ''),
        dataNascimento: d.maeDataNascimento || d.dataNascimentoMae ? formatarData(d.maeDataNascimento || d.dataNascimentoMae) : '',
      })
    }

    // Dados do Pai
    const paiNome = d.paiNome || d.nomePai || aluno.pai
    if (paiNome && typeof paiNome === 'string' && paiNome.trim()) {
      list.push({
        id: 'pai',
        tipo: 'Pai',
        nome: paiNome.trim(),
        cpf: formatarCpf(d.paiCpf || d.cpfPai || ''),
        email: d.paiEmail || d.emailPai || '',
        telefone: formatarTelefone(d.paiTelefone || d.telefonePai || d.celularPai || ''),
        dataNascimento: d.paiDataNascimento || d.dataNascimentoPai ? formatarData(d.paiDataNascimento || d.dataNascimentoPai) : '',
      })
    }

    // Responsável Financeiro explícito
    const finNome = aluno.responsavelFinanceiro || aluno.responsavel_financeiro || d.responsavelFinanceiro
    if (finNome && typeof finNome === 'string' && finNome.trim()) {
      list.push({
        id: 'fin',
        tipo: 'Resp. Financeiro',
        nome: finNome.trim(),
        cpf: formatarCpf(aluno.cpfResponsavelFinanceiro || d.cpfResponsavelFinanceiro || aluno.responsavel_cpf || ''),
        email: aluno.emailResponsavelFinanceiro || d.emailResponsavelFinanceiro || aluno.email || '',
        telefone: formatarTelefone(aluno.telResponsavelFinanceiro || d.telResponsavelFinanceiro || aluno.telefone || ''),
        dataNascimento: aluno.dataNascimentoResponsavelFinanceiro || d.dataNascimentoResponsavelFinanceiro ? formatarData(aluno.dataNascimentoResponsavelFinanceiro || d.dataNascimentoResponsavelFinanceiro) : '',
        isFinanceiro: true,
      })
    }

    // Responsável Pedagógico explícito
    const pedNome = aluno.responsavelPedagogico || aluno.responsavel_pedagogico || d.responsavelPedagogico
    if (pedNome && typeof pedNome === 'string' && pedNome.trim()) {
      list.push({
        id: 'ped',
        tipo: 'Resp. Pedagógico',
        nome: pedNome.trim(),
        cpf: formatarCpf(aluno.cpfResponsavelPedagogico || d.cpfResponsavelPedagogico || ''),
        email: aluno.emailResponsavelPedagogico || d.emailResponsavelPedagogico || '',
        telefone: formatarTelefone(aluno.telResponsavelPedagogico || d.telResponsavelPedagogico || ''),
        dataNascimento: aluno.dataNascimentoResponsavelPedagogico || d.dataNascimentoResponsavelPedagogico ? formatarData(aluno.dataNascimentoResponsavelPedagogico || d.dataNascimentoResponsavelPedagogico) : '',
        isPedagogico: true,
      })
    }

    // Responsável Geral
    const respGeral = aluno.responsavel || aluno.responsavel_nome || d.responsavel
    if (respGeral && typeof respGeral === 'string' && respGeral.trim()) {
      list.push({
        id: 'geral',
        tipo: 'Responsável',
        nome: respGeral.trim(),
        cpf: formatarCpf(aluno.responsavel_cpf || aluno.cpf_responsavel || d.responsavelCpf || ''),
        email: aluno.responsavel_email || aluno.emailResponsavel || aluno.email || '',
        telefone: formatarTelefone(aluno.responsavel_telefone || aluno.telResponsavel || aluno.telefone || ''),
        dataNascimento: aluno.responsavel_data_nascimento || d.responsavelDataNascimento ? formatarData(aluno.responsavel_data_nascimento || d.responsavelDataNascimento) : '',
      })
    }

    return deduplicarResponsaveis(list)
  }

  // Mescla registros retornados da API de aluno_responsavel
  const mesclarResponsaveis = (existentes: ResponsavelOption[], apiResps: any[]): ResponsavelOption[] => {
    const apiOptions: ResponsavelOption[] = apiResps.map((r: any) => ({
      id: String(r.id || ''),
      tipo: r.parentesco || (r.resp_financeiro ? 'Resp. Financeiro' : r.resp_pedagogico ? 'Resp. Pedagógico' : 'Responsável'),
      nome: (r.nome || '').trim(),
      cpf: formatarCpf(r.cpf || r.cpf_cnpj || ''),
      email: r.email || '',
      telefone: formatarTelefone(r.telefone || r.celular || ''),
      dataNascimento: r.data_nascimento || r.dataNascimento ? formatarData(r.data_nascimento || r.dataNascimento) : '',
      isFinanceiro: Boolean(r.resp_financeiro || r.isFinanceiro),
      isPedagogico: Boolean(r.resp_pedagogico || r.isPedagogico),
    })).filter(r => r.nome)

    return deduplicarResponsaveis([...apiOptions, ...existentes])
  }

  // Preenche dados ao selecionar um responsável
  const selecionarResponsavel = (r: ResponsavelOption, alunoRef?: any) => {
    setResponsavelSelecionadoId(r.id || r.nome)
    setFormNovo(prev => ({
      ...prev,
      aluno_id: alunoRef ? String(alunoRef.id) : prev.aluno_id,
      aluno_nome: alunoRef ? alunoRef.nome : prev.aluno_nome,
      signatario_nome: r.nome,
      signatario_cpf: r.cpf || prev.signatario_cpf,
      signatario_email: r.email || prev.signatario_email,
      signatario_telefone: r.telefone || prev.signatario_telefone,
      signatario_data_nascimento: r.dataNascimento || prev.signatario_data_nascimento,
      signatario_cargo: r.tipo || prev.signatario_cargo || 'Responsável',
    }))
  }

  // Seleciona um aluno no modal e extrai seus responsáveis para escolha rápida
  const handleSelecionarAluno = async (aluno: any) => {
    const nomeTurmaCalculado = getNomeTurma(aluno)
    const alunoFormatado = {
      ...aluno,
      turma_nome: nomeTurmaCalculado,
      turma: isNaN(Number(aluno.turma)) ? aluno.turma : nomeTurmaCalculado,
    }
    setAlunoSelecionado(alunoFormatado)
    setBuscaAlunoInput(aluno.nome)
    setDropdownAlunosAberto(false)
    setCarregandoResponsaveis(true)
    setResponsaveisDisponiveis([])
    setResponsavelSelecionadoId(null)

    // Auto-seleciona o CNPJ/Representante compatível com o segmento do aluno
    const turmaStr = `${aluno.serie || ''} ${nomeTurmaCalculado || aluno.turma || ''} ${aluno.nivel || ''}`.toUpperCase()
    const isMedio = turmaStr.includes('EM') || turmaStr.includes('MÉDIO') || turmaStr.includes('MEDIO')
    const repSugerido = isMedio
      ? configData.representantes.find(r => r.cnpj === '04.397.021/0001-43' || r.segmento?.toLowerCase().includes('médio'))
      : configData.representantes.find(r => r.cnpj === '04.395.789/0001-88' || r.padrao)

    if (repSugerido) {
      setFormNovo(prev => ({ ...prev, escola_representante_id: repSugerido.id }))
    }

    // 1. Extração preliminar imediata a partir dos dados locais do aluno
    const listaInicial: ResponsavelOption[] = extrairResponsaveisDoAluno(aluno)
    setResponsaveisDisponiveis(listaInicial)

    if (listaInicial.length > 0) {
      const preferencial = listaInicial.find(r => r.isFinanceiro) || listaInicial[0]
      selecionarResponsavel(preferencial, aluno)
    } else {
      setFormNovo(prev => ({
        ...prev,
        aluno_id: String(aluno.id),
        aluno_nome: aluno.nome,
      }))
    }

    // 2. Busca assíncrona na tabela dedicada aluno_responsavel
    try {
      const res = await fetch(`/api/aluno-responsavel?aluno_id=${encodeURIComponent(aluno.id)}`)
      if (res.ok) {
        const data = await res.json()
        const respsApi: any[] = data.responsaveis || []
        if (respsApi.length > 0) {
          const listaAtualizada = mesclarResponsaveis(listaInicial, respsApi)
          setResponsaveisDisponiveis(listaAtualizada)
          const preferencial = listaAtualizada.find(r => r.isFinanceiro) || listaAtualizada[0]
          if (preferencial) {
            selecionarResponsavel(preferencial, aluno)
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar tabela aluno_responsavel:', e)
    } finally {
      setCarregandoResponsaveis(false)
    }
  }

  // Limpa o aluno selecionado
  const handleLimparAluno = () => {
    setAlunoSelecionado(null)
    setBuscaAlunoInput('')
    setAlunosSugeridos([])
    setDropdownAlunosAberto(false)
    setResponsaveisDisponiveis([])
    setResponsavelSelecionadoId(null)
    setFormNovo(prev => ({
      ...prev,
      aluno_id: '',
      aluno_nome: '',
    }))
  }

  // Processa múltiplos arquivos selecionados ou arrastados (PDF, DOCX ou DOC)
  const processarArquivosSelecionados = async (files: File[]) => {
    if (!files || files.length === 0) return

    const arquivosValidos: File[] = []
    for (const f of files) {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      const formatoValido =
        ext === 'pdf' ||
        ext === 'docx' ||
        ext === 'doc' ||
        f.type === 'application/pdf' ||
        f.type === 'application/msword' ||
        f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      if (formatoValido) {
        arquivosValidos.push(f)
      } else {
        toast.error(`Formato do arquivo "${f.name}" não suportado. Envie arquivos PDF ou Word (.docx / .doc).`)
      }
    }

    if (arquivosValidos.length === 0) return

    setConvertendoDocumento(true)
    setStatusConversao(`Iniciando processamento de ${arquivosValidos.length} documento(s)...`)

    try {
      const novosItens = await processarArquivosEmLote(arquivosValidos, {
        onProgress: (info) => {
          setStatusConversao(info.etapa)
        },
      })

      setDocumentosUpload(prev => {
        const atualizados = [...prev, ...novosItens]
        // Se ainda não havia título, preenche com sugestão automática
        if (!formNovo.titulo_documento.trim()) {
          const nomePrimeiro = atualizados[0].nome
            .replace(/\.(docx?|pdf)$/i, '')
            .replace(/[_-]+/g, ' ')
            .trim()
          const tituloSugerido =
            atualizados.length > 1
              ? `Pacote de Documentos (${atualizados.length} arquivos): ${nomePrimeiro}`
              : nomePrimeiro
          setFormNovo(f => ({ ...f, titulo_documento: f.titulo_documento || tituloSugerido }))
        }
        return atualizados
      })

      setPdfUnificadoPreview(null)

      if (arquivosValidos.length === 1) {
        toast.success(`Documento "${arquivosValidos[0].name}" pronto para emissão!`)
      } else {
        toast.success(`${arquivosValidos.length} documentos adicionados com sucesso!`)
      }
    } catch (err: any) {
      console.error('Erro ao processar documentos:', err)
      toast.error(err.message || 'Falha ao processar os documentos.')
    } finally {
      setConvertendoDocumento(false)
      setStatusConversao('')
    }
  }

  // Lida com upload do input file (suporte a múltiplos arquivos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      processarArquivosSelecionados(files)
    }
    e.target.value = ''
  }

  // Remove um arquivo específico da lista
  const handleRemoverDocumento = (id: string) => {
    setDocumentosUpload(prev => {
      const filtrados = prev.filter(d => d.id !== id)
      if (filtrados.length === 0) {
        setPdfUnificadoPreview(null)
      }
      return filtrados
    })
    if (docPreviaAtivo?.id === id) {
      setDocPreviaAtivo(null)
      setModalPreviaPdfAberto(false)
    }
    toast.info('Documento removido da seleção.')
  }

  // Limpa todos os arquivos atualmente selecionados
  const handleLimparTodosDocumentos = () => {
    setDocumentosUpload([])
    setDocPreviaAtivo(null)
    setPdfUnificadoPreview(null)
    setModalPreviaPdfAberto(false)
    toast.info('Todos os arquivos foram removidos.')
  }

  // Reordena documento na lista (sobe ou desce na sequência do PDF final)
  const handleMoverDocumento = (index: number, direcao: 'cima' | 'baixo') => {
    setDocumentosUpload(prev => {
      const novoArr = [...prev]
      const targetIndex = direcao === 'cima' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= novoArr.length) return prev
      const temp = novoArr[index]
      novoArr[index] = novoArr[targetIndex]
      novoArr[targetIndex] = temp
      return novoArr
    })
    setPdfUnificadoPreview(null)
  }

  // Abre prévia de documento individual
  const handleAbrirPreviaIndividual = (doc: DocumentoUploadItem) => {
    setDocPreviaAtivo(doc)
    setPreviaEhPacoteUnificado(false)
    setModalPreviaPdfAberto(true)
  }

  // Abre prévia do pacote unificado consolidando todos os PDFs
  const handleAbrirPreviaPacoteUnificado = async () => {
    if (documentosUpload.length === 0) return
    if (documentosUpload.length === 1) {
      handleAbrirPreviaIndividual(documentosUpload[0])
      return
    }

    try {
      setGerandoPreviaPacote(true)
      const mesclado = await mesclarMultiplosDocumentosPdf(
        documentosUpload,
        formNovo.titulo_documento
          ? `${formNovo.titulo_documento.replace(/[^\w.-]/gi, '_')}.pdf`
          : undefined
      )
      setPdfUnificadoPreview(mesclado)
      setPreviaEhPacoteUnificado(true)
      setDocPreviaAtivo(null)
      setModalPreviaPdfAberto(true)
    } catch (err: any) {
      toast.error('Erro ao gerar prévia do pacote: ' + err.message)
    } finally {
      setGerandoPreviaPacote(false)
    }
  }

  // Submissão do novo envio de documento (unificado ou em lote)
  const handleCriarContrato = async (e: React.FormEvent) => {
    e.preventDefault()

    if (convertendoDocumento) {
      toast.error('Aguarde a conclusão da conversão dos documentos para PDF antes de emitir.')
      return
    }

    if (documentosUpload.length === 0) {
      toast.error('Por favor, selecione ou faça upload de pelo menos um arquivo PDF ou Word (.docx/.doc) para assinatura.')
      return
    }
    if (!formNovo.signatario_nome.trim()) {
      toast.error('Informe o nome do signatário.')
      return
    }
    if (!formNovo.signatario_email.trim()) {
      toast.error('Informe o e-mail do signatário para validação OTP.')
      return
    }

    setSalvandoContrato(true)
    try {
      const repEscolhido = configData.representantes.find(r => r.id === formNovo.escola_representante_id) || configData.representantes[0]

      const payloadBase: any = {
        signatario_nome: formNovo.signatario_nome,
        signatario_email: formNovo.signatario_email,
        signatario_cpf: formNovo.signatario_cpf,
        signatario_telefone: formNovo.signatario_telefone,
        signatario_data_nascimento: formNovo.signatario_data_nascimento || undefined,
        signatario_cargo: formNovo.signatario_cargo,
        aluno_id: formNovo.aluno_id || undefined,
        aluno_nome: formNovo.aluno_nome || undefined,
        ano_letivo: formNovo.ano_letivo || ultimoAnoCadastrado,
        escola_representante_id: repEscolhido?.id,
        escola_representante_nome: repEscolhido?.nome,
        escola_representante_cpf: repEscolhido?.cpf,
        escola_representante_cargo: repEscolhido?.cargo,
        escola_razao_social: repEscolhido?.razaoSocial,
        escola_cnpj: repEscolhido?.cnpj,
      }

      let payloadFinal: any = { ...payloadBase }

      if (modoEnvioMultiplo === 'separados' && documentosUpload.length > 1) {
        // Modo Documentos Separados (Emissão em Lote)
        payloadFinal.modo_envio = 'separados'
        payloadFinal.documentos = documentosUpload.map((doc, idx) => ({
          pdf_base64: doc.pdfBase64,
          cleanBase64: doc.cleanBase64,
          nome: doc.nome,
          arquivo_nome: doc.nome,
          titulo: doc.nome.replace(/\.(docx?|pdf)$/i, '').replace(/[_-]+/g, ' ').trim(),
          totalPaginas: doc.totalPaginas,
          formatoOriginal: doc.formatoOriginal,
        }))
      } else {
        // Modo Pacote Unificado (ou 1 único arquivo)
        let pdfFinalBase64 = documentosUpload[0].pdfBase64
        let nomeArquivoFinal = documentosUpload[0].nome
        let totalPaginasFinal = documentosUpload[0].totalPaginas

        if (documentosUpload.length > 1) {
          const resultadoMesclado = await mesclarMultiplosDocumentosPdf(
            documentosUpload,
            formNovo.titulo_documento ? `${formNovo.titulo_documento.replace(/[^\w.-]/gi, '_')}.pdf` : undefined
          )
          pdfFinalBase64 = resultadoMesclado.pdfBase64
          nomeArquivoFinal = resultadoMesclado.nomeArquivoPdf
          totalPaginasFinal = resultadoMesclado.totalPaginas
        }

        payloadFinal.modo_envio = 'unificado'
        payloadFinal.pdf_base64 = pdfFinalBase64
        payloadFinal.arquivo_nome = nomeArquivoFinal
        payloadFinal.total_paginas = totalPaginasFinal
        payloadFinal.titulo_documento =
          formNovo.titulo_documento ||
          nomeArquivoFinal.replace(/\.(docx?|pdf)$/i, '') ||
          'Documento para Assinatura'
        payloadFinal.documentos_anexados = documentosUpload.map((d, i) => ({
          ordem: i + 1,
          nome: d.nome,
          tamanhoBytes: d.tamanhoBytes,
          tamanhoFormatado: d.tamanhoFormatado,
          totalPaginas: d.totalPaginas,
          formatoOriginal: d.formatoOriginal,
        }))
      }

      const res = await fetch('/api/matriculas/digital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFinal),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao emitir documento digital.')
      }

      if (data.modo_envio === 'separados') {
        toast.success(`${data.total || documentosUpload.length} documentos emitidos com sucesso!`)
      } else if (documentosUpload.length > 1) {
        toast.success(`Pacote com ${documentosUpload.length} documentos unificados e emitido com sucesso!`)
      } else {
        toast.success('Documento enviado e disponibilizado para assinatura!')
      }

      setContratoCriadoSucesso(data)
      carregarContratos()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvandoContrato(false)
    }
  }

  // Excluir Documento / Arquivo definitivamente
  const handleExcluirContrato = async (id: string, protocolo: string, titulo?: string) => {
    const rotulo = titulo ? `"${titulo}" (${protocolo})` : protocolo
    if (!confirm(`Deseja realmente excluir permanentemente o documento ${rotulo}?\n\nEsta ação excluirá o arquivo e todos os seus registros do sistema de forma irreversível.`)) {
      return
    }

    setExcluindoId(id)
    try {
      const res = await fetch(`/api/matriculas/digital?id=${encodeURIComponent(id)}&tipo=excluir`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Documento ${protocolo} excluído com sucesso!`)
        if (modalAuditoriaContrato?.id === id) {
          setModalAuditoriaContrato(null)
        }
        await carregarContratos()
      } else {
        toast.error(data.error || 'Erro ao excluir documento.')
      }
    } catch {
      toast.error('Erro de conexão ao excluir documento.')
    } finally {
      setExcluindoId(null)
    }
  }

  // Cancelar Assinatura (para documentos pendentes)
  const handleCancelarContrato = async (id: string, protocolo: string) => {
    if (!confirm(`Deseja revogar/cancelar a emissão do documento ${protocolo}? O link de assinatura será invalidado.`)) {
      return
    }

    try {
      const res = await fetch(`/api/matriculas/digital?id=${encodeURIComponent(id)}&tipo=cancelar&motivo=Cancelado+pelo+operador`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Documento ${protocolo} cancelado com sucesso.`)
        await carregarContratos()
      } else {
        toast.error(data.error || 'Erro ao cancelar documento.')
      }
    } catch {
      toast.error('Erro de conexão ao cancelar.')
    }
  }

  // Reenviar OTP
  const handleReenviarOtp = async (contrato: ContratoItem) => {
    try {
      const res = await fetch('/api/matriculas/digital/enviar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratoId: contrato.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Código de verificação reenviado para ${data.emailMascarado}!`)
      } else {
        toast.error(data.error || 'Erro ao reenviar código.')
      }
    } catch {
      toast.error('Erro de rede ao reenviar código.')
    }
  }

  // Reenviar Cópia do Contrato Assinado por E-mail
  const [reenviandoEmailId, setReenviandoEmailId] = useState<string | null>(null)

  const handleReenviarDocumentoEmail = async (contrato: ContratoItem, emailAlternativo?: string) => {
    const destino = emailAlternativo || contrato.responsavel_email
    setReenviandoEmailId(contrato.id)
    try {
      const res = await fetch('/api/matriculas/digital/reenviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId: contrato.id,
          protocolo: contrato.protocolo,
          email_destinatario: destino,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Cópia do contrato enviada para ${data.destinatario || destino}! ✉️`)
        await carregarContratos()
      } else {
        toast.error(data.error || 'Falha ao reenviar cópia por e-mail.')
      }
    } catch {
      toast.error('Erro de conexão ao reenviar e-mail do contrato.')
    } finally {
      setReenviandoEmailId(null)
    }
  }

  // Helper robusto para copiar com animação e feedback
  const copiarTextoComFeedback = async (texto: string, onSuccess?: () => void) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = texto
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      onSuccess?.()
    } catch (err) {
      console.error('Falha ao copiar:', err)
      toast.error('Não foi possível copiar automaticamente.')
    }
  }

  // Copiar link de assinatura
  const handleCopiarLink = (token: string) => {
    const link = `${window.location.origin}/assinar/${token}`
    copiarTextoComFeedback(link, () => {
      setCopiadoTokenLink(token)
      toast.success('Link de assinatura copiado com sucesso! 📋')
      setTimeout(() => setCopiadoTokenLink(null), 2500)
    })
  }

  // Abrir WhatsApp com mensagem pronta personalizada pela escola
  const handleCompartilharWhatsApp = (contrato: ContratoItem) => {
    const signUrl = `${window.location.origin}/assinar/${contrato.token_assinatura}`
    const totalDocs = (contrato.evidencias as any)?.totalDocumentos || 1
    const docTitulo = totalDocs > 1
      ? `${contrato.titulo_documento} (${totalDocs} anexos)`
      : contrato.titulo_documento

    const texto = formatarMensagemWhatsApp(configData.whatsappTemplate, {
      responsavel: contrato.responsavel_nome,
      documento: docTitulo,
      aluno: contrato.aluno_nome,
      ano: contrato.ano_letivo,
      link_assinatura: signUrl,
      email: contrato.responsavel_email,
      escola: 'Colégio Impacto',
      protocolo: contrato.protocolo,
    })

    const foneClean = (contrato.responsavel_telefone || '').replace(/\D/g, '')
    const url = getWhatsAppShareUrl(foneClean, texto)
    window.open(url, '_blank')
  }

  // Gerar texto simulado para prévia e teste do WhatsApp
  const gerarTextoMensagemTeste = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://impacto-edu.net'
    return formatarMensagemWhatsApp(configData.whatsappTemplate, {
      responsavel: 'Ivan Rossi',
      documento: 'CONTRATO NV1 e NV2 2027',
      aluno: 'Cecília Graziela Marinho Fonseca',
      ano: '2027',
      link_assinatura: `${origin}/assinar/teste-preview-${Date.now().toString(36)}`,
      email: 'ivanrossims@gmail.com',
      escola: configData.representantes?.[0]?.razaoSocial?.includes('IMPACTO') ? 'Colégio Impacto' : (configData.representantes?.[0]?.nome || 'Colégio Impacto'),
      protocolo: 'IMP-2027-0012',
    })
  }

  // Disparar teste de envio do WhatsApp em tempo real
  const handleTestarEnvioWhatsApp = (telefoneDestino?: string) => {
    const destino = telefoneDestino !== undefined ? telefoneDestino : telefoneTesteWhatsapp
    const texto = gerarTextoMensagemTeste()
    const telLimpo = (destino || '').replace(/\D/g, '')
    const url = getWhatsAppShareUrl(telLimpo, texto)
    window.open(url, '_blank')
    if (telLimpo) {
      toast.success(`Abrindo WhatsApp para o número (${telLimpo})...`)
    } else {
      toast.success('Abrindo WhatsApp para você escolher o contato ou grupo!')
    }
  }

  // Download do PDF legado via Base64
  const handleDownloadPdf = (base64Data: string, filename: string) => {
    const linkSource = `data:application/pdf;base64,${base64Data}`
    const downloadLink = document.createElement('a')
    downloadLink.href = linkSource
    downloadLink.download = filename
    downloadLink.click()
  }

  // Download assíncrono oficial e sob demanda do PDF do contrato
  const handleBaixarPdf = async (c: ContratoItem, versao: 'assinado' | 'original' = 'assinado') => {
    // 1. Se o documento já estiver em memória em Base64
    const b64 = versao === 'assinado' ? c.documento_assinado_pdf_base64 : c.documento_pdf_base64
    if (b64) {
      handleDownloadPdf(
        b64,
        `${(c.titulo_documento || 'documento').replace(/[^\w.-]/gi, '_')}_${versao === 'assinado' ? 'Assinado' : 'Original'}_${c.protocolo}.pdf`
      )
      return
    }

    // 2. Busca sob demanda via API dedicada (leve e resiliente em todos os browsers)
    try {
      setBaixandoPdfId(`${c.id}_${versao}`)
      const res = await fetch(`/api/matriculas/digital/pdf/${encodeURIComponent(c.token_assinatura || c.protocolo)}?versao=${versao}&download=1`)
      if (!res.ok) {
        throw new Error('Não foi possível obter o documento em PDF para download.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${(c.titulo_documento || 'documento').replace(/[^\w.-]/gi, '_')}_${versao === 'assinado' ? 'Assinado' : 'Original'}_${c.protocolo}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(versao === 'assinado' ? 'Download do documento assinado concluído!' : 'Download da minuta concluído!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao baixar o documento PDF.')
    } finally {
      setBaixandoPdfId(null)
    }
  }

  // Upload e leitura do logotipo oficial da instituição
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem (PNG, JPG ou WebP).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem da logomarca deve ter no máximo 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setConfigData(prev => ({ ...prev, logoUrl: b64 }))
      toast.success('Logomarca carregada com sucesso! Clique em "Salvar Configurações" para confirmar.')
    }
    reader.readAsDataURL(file)
  }

  // Salvar Configurações
  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvandoConfig(true)
    try {
      const res = await fetch('/api/matriculas/digital/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      })
      if (res.ok) {
        toast.success('Configurações salvas com sucesso!')
        setModalConfigAberto(false)
        await carregarConfiguracoes()
      } else {
        toast.error('Erro ao salvar configurações.')
      }
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Testar conexão SMTP
  const handleTestarSmtp = async () => {
    setTestandoSmtp(true)
    try {
      const res = await fetch('/api/matriculas/digital/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_smtp', smtp: configData.smtp }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Conexão SMTP validada com sucesso! O servidor de e-mail está pronto.')
      } else {
        toast.error(`Falha no teste SMTP: ${data.error || 'Verifique as credenciais.'}`)
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao testar SMTP.')
    } finally {
      setTestandoSmtp(false)
    }
  }

  // Processa arquivo no verificador de hash
  const handleProcessarArquivoVerificador = async (file: File) => {
    setChecandoArquivo(true)
    setArquivoResultado(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
      setArquivoHashCalc(hashHex)

      const res = await fetch('/api/matriculas/digital/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hashHex }),
      })
      const data = await res.json()
      setArquivoResultado(data)
    } catch (err: any) {
      toast.error('Erro ao processar arquivo: ' + err.message)
    } finally {
      setChecandoArquivo(false)
    }
  }

  return (
    <div className="digital-page-container">
      <style dangerouslySetInnerHTML={{__html: `
        .digital-page-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 8px 4px 40px;
        }
        .digital-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
        }
        .digital-header-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .digital-header-logo {
          width: 48px;
          height: 48px;
          object-fit: contain;
          border-radius: 8px;
          flex-shrink: 0;
        }
        .digital-header-title {
          font-size: 26px;
          font-weight: 800;
          margin: 0;
          color: hsl(var(--text-primary));
          letter-spacing: -0.02em;
        }
        .digital-header-badge {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
        .digital-header-desc {
          margin: 6px 0 0;
          font-size: 13px;
          color: hsl(var(--text-secondary));
          line-height: 1.45;
        }
        .digital-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .digital-secondary-actions-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .digital-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .digital-kpi-card {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 16px;
          padding: 20px;
        }
        .digital-kpi-card-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: hsl(var(--text-secondary));
          font-size: 12px;
          fontWeight: 600;
        }
        .digital-kpi-card-value {
          font-size: 28px;
          font-weight: 800;
          margin-top: 8px;
        }
        .digital-kpi-card-sub {
          font-size: 11px;
          margin-top: 4px;
        }
        .digital-filter-bar {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .digital-filter-search {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 260px;
        }
        .digital-filter-selects {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .digital-filter-select-group {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: hsl(var(--text-secondary));
        }
        .digital-desktop-table {
          display: block;
        }
        .digital-mobile-list {
          display: none;
        }
        .digital-mobile-pagination {
          display: none;
        }
        .btn-label-mobile {
          display: none;
        }
        .btn-label-desktop {
          display: inline;
        }

        /* ── BOTÕES DE AÇÕES MODERNOS (SINGLE ROW TOOLBAR & DROPDOWN) ── */
        .digital-action-group {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          flex-wrap: nowrap;
        }
        .digital-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          height: 31px;
          padding: 0 11px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          outline: none;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          user-select: none;
        }
        .digital-action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .digital-action-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .digital-action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Botão Primário: Baixar Doc Assinado */
        .digital-btn-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: 1px solid rgba(16, 185, 129, 0.45);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .digital-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
        }

        /* Botão WhatsApp */
        .digital-btn-whatsapp {
          background: rgba(37, 211, 102, 0.12);
          border: 1px solid rgba(37, 211, 102, 0.32);
          color: #22c55e;
        }
        .digital-btn-whatsapp:hover:not(:disabled) {
          background: rgba(37, 211, 102, 0.22);
          border-color: #22c55e;
          box-shadow: 0 2px 10px rgba(37, 211, 102, 0.2);
        }

        /* Botão WhatsApp Primário (Pendente) */
        .digital-btn-whatsapp-primary {
          background: linear-gradient(135deg, rgba(37, 211, 102, 0.2), rgba(16, 185, 129, 0.28));
          border: 1px solid rgba(37, 211, 102, 0.45);
          color: #22c55e;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(37, 211, 102, 0.18);
        }
        .digital-btn-whatsapp-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(37, 211, 102, 0.3), rgba(16, 185, 129, 0.4));
          border-color: #25d366;
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.28);
        }

        /* Botão Copiar Link */
        .digital-btn-copy {
          background: hsl(var(--bg-elevated));
          border: 1px solid hsl(var(--border-subtle));
          color: hsl(var(--text-primary));
        }
        .digital-btn-copy:hover:not(:disabled) {
          border-color: hsl(var(--text-secondary));
          background: hsl(var(--bg-surface-hover, rgba(255, 255, 255, 0.05)));
        }
        .digital-btn-copy.copied {
          background: rgba(16, 185, 129, 0.18);
          border-color: #10b981;
          color: #10b981;
          font-weight: 700;
        }

        /* Botão Dossiê */
        .digital-btn-dossie {
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.25);
          color: #c084fc;
        }
        .digital-btn-dossie:hover:not(:disabled) {
          background: rgba(168, 85, 247, 0.2);
          border-color: #c084fc;
          box-shadow: 0 2px 10px rgba(168, 85, 247, 0.2);
        }

        /* Botão Mais Opções (...) */
        .digital-btn-more {
          width: 31px;
          height: 31px;
          padding: 0;
          border-radius: 8px;
          background: hsl(var(--bg-elevated));
          border: 1px solid hsl(var(--border-subtle));
          color: hsl(var(--text-secondary));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          outline: none;
          transition: all 0.15s ease;
        }
        .digital-btn-more:hover, .digital-btn-more[data-state="open"] {
          background: hsl(var(--bg-surface-hover, rgba(255, 255, 255, 0.08)));
          border-color: hsl(var(--text-secondary));
          color: hsl(var(--text-primary));
          transform: translateY(-1px);
        }

        /* Dropdown Radix */
        .digital-dropdown-content {
          min-width: 250px;
          background: hsl(var(--bg-elevated));
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 12px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.35), 0 4px 12px -2px rgba(0, 0, 0, 0.15);
          z-index: 9999999;
          outline: none;
          animation: digitalDropdownFade 0.15s ease-out;
        }
        @keyframes digitalDropdownFade {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .digital-dropdown-item {
          min-height: 36px;
          padding: 8px 12px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          font-weight: 500;
          color: hsl(var(--text-primary));
          cursor: pointer;
          user-select: none;
          outline: none;
          text-decoration: none;
          transition: background-color 0.12s ease, color 0.12s ease;
        }
        .digital-dropdown-item:hover, [data-highlighted].digital-dropdown-item {
          background-color: rgba(255, 255, 255, 0.07);
          color: hsl(var(--text-primary));
        }
        .digital-dropdown-item.danger {
          color: #ef4444;
        }
        .digital-dropdown-item.danger:hover, [data-highlighted].digital-dropdown-item.danger {
          background-color: rgba(239, 68, 68, 0.12);
          color: #ef4444;
        }
        .digital-dropdown-item.warning {
          color: #f59e0b;
        }
        .digital-dropdown-item.warning:hover, [data-highlighted].digital-dropdown-item.warning {
          background-color: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
        }
        .digital-dropdown-separator {
          height: 1px;
          background: hsl(var(--border-subtle));
          margin: 4px 0;
        }

        /* ── MODAL ULTRA MODERNO DIGITAL ── */
        .digital-modal-novo-pro {
          box-shadow: 0 32px 80px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
          animation: modalNovoFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .digital-modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.4) transparent;
          -webkit-overflow-scrolling: touch;
        }
        .digital-modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .digital-modal-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.03);
          border-radius: 999px;
        }
        .digital-modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.35);
          border-radius: 999px;
        }
        .digital-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.65);
        }
        .digital-modal-input {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .digital-modal-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18) !important;
        }

        /* ── REGRAS ESPECÍFICAS PARA DISPOSITIVOS MÓVEIS (MOBILE) ── */
        @media (max-width: 768px) {
          .digital-page-container {
            gap: 12px !important;
            padding: 2px 2px 24px !important;
          }
          .digital-header {
            flex-direction: column !important;
            gap: 10px !important;
            align-items: stretch !important;
          }
          .digital-header-info {
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .digital-header-logo {
            width: 36px !important;
            height: 36px !important;
            margin-top: 2px;
          }
          .digital-header-title {
            font-size: 19px !important;
          }
          .digital-header-badge {
            font-size: 8.5px !important;
            padding: 2px 6px !important;
          }
          .digital-header-desc {
            font-size: 11.5px !important;
            margin: 3px 0 0 !important;
            line-height: 1.35 !important;
          }
          .digital-header-actions {
            flex-direction: column !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .digital-header-actions .btn-novo-doc {
            width: 100% !important;
            justify-content: center !important;
            padding: 11px 16px !important;
            font-size: 13px !important;
            order: 1 !important;
          }
          .digital-secondary-actions-group {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 6px !important;
            width: 100% !important;
            order: 2 !important;
          }
          .digital-secondary-actions-group button {
            padding: 8px 4px !important;
            font-size: 11px !important;
            justify-content: center !important;
            text-align: center !important;
            gap: 4px !important;
            border-radius: 8px !important;
            white-space: nowrap !important;
          }
          .digital-secondary-actions-group button span.btn-label-desktop {
            display: none !important;
          }
          .digital-secondary-actions-group button span.btn-label-mobile {
            display: inline !important;
          }
          .btn-label-desktop {
            display: none !important;
          }
          .btn-label-mobile {
            display: inline !important;
          }
          .digital-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .digital-kpi-card {
            padding: 10px 12px !important;
            border-radius: 12px !important;
          }
          .digital-kpi-card-title {
            font-size: 10.5px !important;
          }
          .digital-kpi-card-value {
            font-size: 20px !important;
            margin-top: 3px !important;
          }
          .digital-kpi-card-sub {
            font-size: 9.5px !important;
            margin-top: 2px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .digital-filter-bar {
            padding: 10px 12px !important;
            border-radius: 12px !important;
            gap: 8px !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .digital-filter-search {
            width: 100% !important;
            min-width: 0 !important;
            gap: 8px !important;
          }
          .digital-filter-search > div {
            max-width: 100% !important;
            flex: 1 !important;
          }
          .digital-filter-selects {
            width: 100% !important;
            gap: 8px !important;
            display: flex !important;
          }
          .digital-filter-select-group {
            flex: 1 !important;
            min-width: 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            font-size: 11.5px !important;
          }
          .digital-filter-select-group select {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 11.5px !important;
            padding: 0 6px !important;
            height: 36px !important;
          }
          .digital-desktop-table {
            display: none !important;
          }
          .digital-mobile-list {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
          }
          .digital-mobile-pagination {
            display: block !important;
          }
          .digital-modal-backdrop {
            padding: 8px !important;
          }
          .digital-modal-content {
            border-radius: 14px !important;
            max-height: 94vh !important;
          }
        }
      `}} />

      {/* ── Top Header com Título e Ações Rápidas ── */}
      <div className="digital-header">
        <div className="digital-header-info">
          <img
            src="/logo-impacto-clean.png"
            alt="Colégio Impacto"
            className="digital-header-logo"
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 className="digital-header-title">
                Matrícula Digital
              </h1>
              <span className="digital-header-badge">
                ASSINATURA & CIÊNCIA IMPACTO EDU
              </span>
            </div>
            <p className="digital-header-desc">
              Emissão de termos de ciência, autorizações e documentos escolares para assinatura digital com código OTP, validade jurídica e dossiê de evidências em PDF.
            </p>
          </div>
        </div>

        <div className="digital-header-actions">
          <button
            onClick={() => {
              setAlunoSelecionado(null)
              setBuscaAlunoInput('')
              setAlunosSugeridos([])
              setDropdownAlunosAberto(false)
              setBuscandoAlunos(false)
              setResponsaveisDisponiveis([])
              setResponsavelSelecionadoId(null)
              setCarregandoResponsaveis(false)
              setDocumentosUpload([])
              setModoEnvioMultiplo('unificado')
              setDocPreviaAtivo(null)
              setPreviaEhPacoteUnificado(false)
              setPdfUnificadoPreview(null)
              setArrastandoArquivo(false)
              setContratoCriadoSucesso(null)
              setFormNovo({
                aluno_id: '',
                aluno_nome: '',
                titulo_documento: '',
                escola_representante_id: configData.representantes[0]?.id || 'rep_infantil_fundamental',
                signatario_nome: '',
                signatario_cpf: '',
                signatario_data_nascimento: '',
                signatario_email: '',
                signatario_telefone: '',
                signatario_cargo: 'Responsável',
                ano_letivo: ultimoAnoCadastrado,
              })
              setContratoCriadoSucesso(null)
              setCopiadoModalLink(false)
              setModalNovoAberto(true)
            }}
            className="btn-novo-doc"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <Plus size={16} /> Novo Documento para Assinatura
          </button>

          <div className="digital-secondary-actions-group">
            <button
              onClick={() => setModalVerificadorAberto(true)}
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                color: 'hsl(var(--text-primary))',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
            >
              <Fingerprint size={16} color="#60a5fa" />
              <span className="btn-label-desktop">Verificador de Arquivo</span>
              <span className="btn-label-mobile">Verificador</span>
            </button>

            <button
              onClick={() => {
                carregarConfiguracoes()
                setModalConfigAberto(true)
              }}
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                color: 'hsl(var(--text-primary))',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
            >
              <Settings size={16} />
              <span className="btn-label-desktop">Configurações</span>
              <span className="btn-label-mobile">Configurar</span>
            </button>

            <button
              onClick={() => {
                setModalValidacaoAberto(true)
                setErroValidacaoModal(null)
                if (contratos.length > 0 && !validacaoProtocoloInput) {
                  const primeiroAssinado = contratos.find(c => c.status === 'assinado') || contratos[0]
                  if (primeiroAssinado) {
                    setValidacaoProtocoloInput(primeiroAssinado.protocolo)
                    handleValidarProtocoloNoModal(primeiroAssinado.protocolo)
                  }
                }
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#34d399',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.18)',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.35) 100%)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <ShieldCheck size={16} color="#34d399" />
              <span className="btn-label-desktop">Validação de Contrato</span>
              <span className="btn-label-mobile">Validação</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Cards de Indicadores / Métricas (KPIs) ── */}
      <div className="digital-kpi-grid">
        <div className="digital-kpi-card">
          <div className="digital-kpi-card-title">
            <span>Total de Documentos</span>
            <FileText size={16} color="#3b82f6" />
          </div>
          <div className="digital-kpi-card-value" style={{ color: 'hsl(var(--text-primary))' }}>
            {metrics.total}
          </div>
          <div className="digital-kpi-card-sub" style={{ color: '#3b82f6' }}>Emitidos no ano letivo</div>
        </div>

        <div className="digital-kpi-card">
          <div className="digital-kpi-card-title">
            <span>Aguardando Ciência</span>
            <Clock size={16} color="#f59e0b" />
          </div>
          <div className="digital-kpi-card-value" style={{ color: '#f59e0b' }}>
            {metrics.pendentes}
          </div>
          <div className="digital-kpi-card-sub" style={{ color: 'hsl(var(--text-secondary))' }}>Pendentes com responsável</div>
        </div>

        <div className="digital-kpi-card">
          <div className="digital-kpi-card-title">
            <span>Assinados & Certificados</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="digital-kpi-card-value" style={{ color: '#10b981' }}>
            {metrics.assinados}
          </div>
          <div className="digital-kpi-card-sub" style={{ color: '#10b981' }}>Com Selo SHA-256</div>
        </div>

        <div className="digital-kpi-card">
          <div className="digital-kpi-card-title">
            <span>Taxa de Assinatura</span>
            <ShieldCheck size={16} color="#8b5cf6" />
          </div>
          <div className="digital-kpi-card-value" style={{ color: '#8b5cf6' }}>
            {metrics.taxaAssinatura}%
          </div>
          <div className="digital-kpi-card-sub" style={{ color: '#10b981' }}>100% de Integridade</div>
        </div>
      </div>

      {/* ── Barra de Filtros e Busca ── */}
      <div className="digital-filter-bar">
        <div className="digital-filter-search">
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }} />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && carregarContratos()}
              placeholder="Buscar estudante, responsável ou protocolo..."
              style={{
                width: '100%',
                height: 38,
                background: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 8,
                padding: '0 12px 0 36px',
                fontSize: 13,
                color: 'hsl(var(--text-primary))',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={() => carregarContratos()}
            style={{
              background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border-subtle))',
              color: 'hsl(var(--text-primary))',
              borderRadius: 8,
              padding: '0 14px',
              height: 38,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <Search size={14} /> <span className="btn-label-desktop">Filtrar</span>
          </button>
        </div>

        <div className="digital-filter-selects">
          {/* Filtro Status */}
          <div className="digital-filter-select-group">
            <span className="btn-label-desktop">Status:</span>
            <select
              value={statusFiltro}
              onChange={e => setStatusFiltro(e.target.value)}
              style={{
                height: 38,
                background: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 8,
                padding: '0 8px',
                fontSize: 12.5,
                color: 'hsl(var(--text-primary))',
                outline: 'none',
              }}
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Aguardando Ciência</option>
              <option value="assinado">Assinados</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>

          {/* Filtro Ano Letivo */}
          <div className="digital-filter-select-group">
            <span className="btn-label-desktop">Ano:</span>
            <select
              value={anoFiltro}
              onChange={e => {
                anoAlteradoManualmenteRef.current = true
                setAnoFiltro(e.target.value)
              }}
              style={{
                height: 38,
                background: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 8,
                padding: '0 8px',
                fontSize: 12.5,
                color: 'hsl(var(--text-primary))',
                outline: 'none',
              }}
            >
              {anosLetivosDisponiveis.map(ano => (
                <option key={ano} value={ano}>
                  {ano} {ano === ultimoAnoCadastrado ? '(Atual)' : ''}
                </option>
              ))}
              <option value="todos">Todos Anos</option>
            </select>
          </div>

          <button
            onClick={() => carregarContratos()}
            disabled={loading}
            title="Atualizar lista"
            style={{
              background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border-subtle))',
              color: 'hsl(var(--text-primary))',
              borderRadius: 8,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Tabela Desktop de Documentos para Assinatura ── */}
      <div
        ref={tabelaRef}
        className="digital-desktop-table"
        style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))' }}>
                <th style={{ padding: '14px 18px', fontWeight: 700, width: 160 }}>PROTOCOLO</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>DOCUMENTO</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>SIGNATÁRIO</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>STATUS</th>
                <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right', minWidth: 340 }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                    Carregando documentos para assinatura...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 12px', color: '#ef4444', display: 'block' }} />
                    <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>
                      Não foi possível carregar os documentos
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginBottom: 14 }}>
                      {fetchError}
                    </div>
                    <button
                      onClick={() => carregarContratos()}
                      style={{
                        padding: '6px 16px',
                        background: 'hsl(var(--primary))',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RefreshCw size={14} /> Tentar novamente
                    </button>
                  </td>
                </tr>
              ) : contratos.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                    <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
                    <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                      {anoFiltro && anoFiltro !== 'todos' ? (
                        <>
                          Nenhum documento localizado para o ano letivo <strong>{anoFiltro}</strong>.
                          <div style={{ marginTop: 12 }}>
                            <button
                              onClick={() => {
                                anoAlteradoManualmenteRef.current = true
                                setAnoFiltro('todos')
                              }}
                              style={{
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38bdf8',
                                padding: '6px 14px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Filter size={13} /> Ver documentos de todos os anos
                            </button>
                          </div>
                        </>
                      ) : (
                        'Nenhum documento localizado com os filtros selecionados.'
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                contratosPaginados.map(c => {
                  const isAssinado = c.status === 'assinado'
                  const isCancelado = c.status === 'cancelado'
                  const isPendente = c.status === 'pendente'

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid hsl(var(--border-subtle))',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Protocolo */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <a
                            href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                            target="_blank"
                            rel="noreferrer"
                            title={`Validar contrato ${c.protocolo} oficialmente (Abre validação pesquisada)`}
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: '#38bdf8',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                              borderBottom: '1px dashed rgba(56, 189, 248, 0.45)',
                              paddingBottom: 1,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = '#7dd3fc'
                              e.currentTarget.style.borderBottomColor = '#38bdf8'
                              e.currentTarget.style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = '#38bdf8'
                              e.currentTarget.style.borderBottomColor = 'rgba(56, 189, 248, 0.45)'
                              e.currentTarget.style.transform = 'translateY(0)'
                            }}
                          >
                            {c.protocolo}
                            <ExternalLink size={11} style={{ opacity: 0.7 }} />
                          </a>
                          <button
                            onClick={() => {
                              copiarTextoComFeedback(c.protocolo, () => {
                                setCopiadoProtocoloId(c.protocolo)
                                toast.success(`Protocolo ${c.protocolo} copiado!`)
                                setTimeout(() => setCopiadoProtocoloId(null), 2000)
                              })
                            }}
                            title={copiadoProtocoloId === c.protocolo ? 'Protocolo copiado!' : 'Copiar Protocolo'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiadoProtocoloId === c.protocolo ? '#10b981' : 'hsl(var(--text-secondary))',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'inline-flex',
                              alignItems: 'center',
                              transition: 'all 0.2s ease',
                              transform: copiadoProtocoloId === c.protocolo ? 'scale(1.2)' : 'scale(1)',
                            }}
                          >
                            {copiadoProtocoloId === c.protocolo ? (
                              <Check size={12} style={{ strokeWidth: 3 }} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                          {new Date(c.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      {/* Documento / Título */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                          {c.titulo_documento}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={12} /> Arquivo PDF
                          </span>
                          {(c.evidencias as any)?.totalDocumentos > 1 && (
                            <span
                              title={`Pacote unificado contendo ${(c.evidencias as any).totalDocumentos} documentos mesclados em um único arquivo`}
                              style={{
                                fontSize: 10,
                                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(99, 102, 241, 0.18) 100%)',
                                color: '#38bdf8',
                                padding: '1px 7px',
                                borderRadius: 6,
                                fontWeight: 700,
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3.5,
                              }}
                            >
                              <Layers size={10} /> {(c.evidencias as any).totalDocumentos} docs unificados
                            </span>
                          )}
                          {c.ano_letivo && (
                            <span style={{ fontSize: 10, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                              Ano {c.ano_letivo}
                            </span>
                          )}
                          {c.aluno_nome && (
                            <span style={{ fontSize: 10, background: 'rgba(59, 130, 246, 0.12)', color: '#93c5fd', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              Ref: {c.aluno_nome}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Signatário */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{c.responsavel_nome}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                          {c.responsavel_email}
                        </div>
                        {(c.responsavel_cpf || c.responsavel_telefone) && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                            {c.responsavel_cpf ? `CPF: ${c.responsavel_cpf}` : ''}{c.responsavel_cpf && c.responsavel_telefone ? ' • ' : ''}{c.responsavel_telefone}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        {isAssinado ? (
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={12} /> Assinado
                          </span>
                        ) : isCancelado ? (
                          <span
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <AlertCircle size={12} /> Cancelado
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Clock size={12} /> Pendente
                          </span>
                        )}
                      </td>

                      {/* Ações Modernas em Linha Única */}
                      <td style={{ padding: '12px 18px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div className="digital-action-group">
                          {/* 1. DOCUMENTO ASSINADO */}
                          {isAssinado && (
                            <>
                              {/* Botão Primário: Baixar Doc Assinado */}
                              <button
                                onClick={() => handleBaixarPdf(c, 'assinado')}
                                disabled={baixandoPdfId === `${c.id}_assinado`}
                                title="Baixar Documento Oficial Assinado com Certificado Digital (PDF)"
                                className="digital-action-btn digital-btn-primary"
                              >
                                {baixandoPdfId === `${c.id}_assinado` ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Baixando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download size={13} style={{ strokeWidth: 2.4 }} />
                                    <span>Baixar Doc Assinado</span>
                                  </>
                                )}
                              </button>

                              {/* WhatsApp */}
                              <button
                                onClick={() => handleCompartilharWhatsApp(c)}
                                title="Enviar Comprovante e Link pelo WhatsApp"
                                className="digital-action-btn digital-btn-whatsapp"
                              >
                                <MessageSquare size={13} />
                                <span>WhatsApp</span>
                              </button>

                              {/* Dossiê */}
                              <button
                                onClick={() => setModalAuditoriaContrato(c)}
                                title="Ver Dossiê e Trilha de Auditoria Digital Imutável"
                                className="digital-action-btn digital-btn-dossie"
                              >
                                <ShieldCheck size={13} />
                                <span>Dossiê</span>
                              </button>

                              {/* Menu Mais Opções (...) */}
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button
                                    className="digital-btn-more"
                                    title="Mais opções do documento"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <MoreHorizontal size={15} />
                                  </button>
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    side="bottom"
                                    sideOffset={6}
                                    className="digital-dropdown-content"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {/* Validar Assinatura Pública */}
                                    <DropdownMenu.Item asChild>
                                      <a
                                        href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="digital-dropdown-item"
                                      >
                                        <BadgeCheck size={15} color="#38bdf8" />
                                        <span>Validar Assinatura Pública</span>
                                      </a>
                                    </DropdownMenu.Item>

                                    {/* Reenviar Cópia Oficial por E-mail */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleReenviarDocumentoEmail(c)}
                                        className="digital-dropdown-item"
                                        style={{ cursor: reenviandoEmailId === c.id ? 'wait' : 'pointer' }}
                                      >
                                        {reenviandoEmailId === c.id ? (
                                          <Loader2 size={15} className="animate-spin" color="#38bdf8" />
                                        ) : (
                                          <Mail size={15} color="#38bdf8" />
                                        )}
                                        <span>Reenviar Cópia por E-mail</span>
                                      </div>
                                    </DropdownMenu.Item>

                                    {/* Copiar Link de Acesso */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleCopiarLink(c.token_assinatura)}
                                        className="digital-dropdown-item"
                                      >
                                        {copiadoTokenLink === c.token_assinatura ? (
                                          <Check size={15} color="#10b981" style={{ strokeWidth: 2.5 }} />
                                        ) : (
                                          <Copy size={15} color="#10b981" />
                                        )}
                                        <span>
                                          {copiadoTokenLink === c.token_assinatura ? 'Link Copiado!' : 'Copiar Link de Acesso'}
                                        </span>
                                      </div>
                                    </DropdownMenu.Item>

                                    <div className="digital-dropdown-separator" />

                                    {/* Excluir Documento */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleExcluirContrato(c.id, c.protocolo, c.titulo_documento)}
                                        className="digital-dropdown-item danger"
                                        style={{ cursor: excluindoId === c.id ? 'wait' : 'pointer' }}
                                      >
                                        {excluindoId === c.id ? (
                                          <Loader2 size={15} className="animate-spin" color="#ef4444" />
                                        ) : (
                                          <Trash2 size={15} color="#ef4444" />
                                        )}
                                        <span>Excluir Documento</span>
                                      </div>
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </>
                          )}

                          {/* 2. DOCUMENTO PENDENTE */}
                          {isPendente && (
                            <>
                              {/* Botão Primário: WhatsApp para Enviar / Cobrar */}
                              <button
                                onClick={() => handleCompartilharWhatsApp(c)}
                                title="Enviar Link de Assinatura pelo WhatsApp"
                                className="digital-action-btn digital-btn-whatsapp-primary"
                              >
                                <MessageSquare size={13} />
                                <span>WhatsApp</span>
                              </button>

                              {/* Botão Copiar Link */}
                              <button
                                onClick={() => handleCopiarLink(c.token_assinatura)}
                                title={copiadoTokenLink === c.token_assinatura ? 'Link Copiado!' : 'Copiar Link de Assinatura'}
                                className={`digital-action-btn digital-btn-copy ${copiadoTokenLink === c.token_assinatura ? 'copied' : ''}`}
                              >
                                {copiadoTokenLink === c.token_assinatura ? (
                                  <>
                                    <Check size={13} style={{ strokeWidth: 2.5 }} />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} />
                                    <span>Copiar Link</span>
                                  </>
                                )}
                              </button>

                              {/* Dossiê */}
                              <button
                                onClick={() => setModalAuditoriaContrato(c)}
                                title="Ver Dossiê e Trilha de Auditoria Digital"
                                className="digital-action-btn digital-btn-dossie"
                              >
                                <ShieldCheck size={13} />
                                <span>Dossiê</span>
                              </button>

                              {/* Menu Mais Opções (...) */}
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button
                                    className="digital-btn-more"
                                    title="Mais opções do documento"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <MoreHorizontal size={15} />
                                  </button>
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    side="bottom"
                                    sideOffset={6}
                                    className="digital-dropdown-content"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {/* Reenviar Código OTP por E-mail */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleReenviarOtp(c)}
                                        className="digital-dropdown-item"
                                      >
                                        <Mail size={15} color="#38bdf8" />
                                        <span>Reenviar Código OTP por E-mail</span>
                                      </div>
                                    </DropdownMenu.Item>

                                    {/* Baixar Minuta Original (PDF) */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleBaixarPdf(c, 'original')}
                                        className="digital-dropdown-item"
                                        style={{ cursor: baixandoPdfId === `${c.id}_original` ? 'wait' : 'pointer' }}
                                      >
                                        {baixandoPdfId === `${c.id}_original` ? (
                                          <Loader2 size={15} className="animate-spin" color="#94a3b8" />
                                        ) : (
                                          <Download size={15} color="#94a3b8" />
                                        )}
                                        <span>Baixar Minuta Original (PDF)</span>
                                      </div>
                                    </DropdownMenu.Item>

                                    {/* Validar Documento */}
                                    <DropdownMenu.Item asChild>
                                      <a
                                        href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="digital-dropdown-item"
                                      >
                                        <BadgeCheck size={15} color="#38bdf8" />
                                        <span>Validar Documento Oficial</span>
                                      </a>
                                    </DropdownMenu.Item>

                                    <div className="digital-dropdown-separator" />

                                    {/* Cancelar / Revogar Link */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleCancelarContrato(c.id, c.protocolo)}
                                        className="digital-dropdown-item warning"
                                      >
                                        <Ban size={15} color="#f59e0b" />
                                        <span>Revogar / Cancelar Link</span>
                                      </div>
                                    </DropdownMenu.Item>

                                    {/* Excluir Documento */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleExcluirContrato(c.id, c.protocolo, c.titulo_documento)}
                                        className="digital-dropdown-item danger"
                                        style={{ cursor: excluindoId === c.id ? 'wait' : 'pointer' }}
                                      >
                                        {excluindoId === c.id ? (
                                          <Loader2 size={15} className="animate-spin" color="#ef4444" />
                                        ) : (
                                          <Trash2 size={15} color="#ef4444" />
                                        )}
                                        <span>Excluir Documento</span>
                                      </div>
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </>
                          )}

                          {/* 3. DOCUMENTO CANCELADO */}
                          {isCancelado && (
                            <>
                              {/* Dossiê */}
                              <button
                                onClick={() => setModalAuditoriaContrato(c)}
                                title="Ver Dossiê e Trilha de Auditoria Digital"
                                className="digital-action-btn digital-btn-dossie"
                              >
                                <ShieldCheck size={13} />
                                <span>Dossiê</span>
                              </button>

                              {/* Menu Mais Opções (...) */}
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button
                                    className="digital-btn-more"
                                    title="Mais opções do documento"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <MoreHorizontal size={15} />
                                  </button>
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    side="bottom"
                                    sideOffset={6}
                                    className="digital-dropdown-content"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {/* Validar Documento */}
                                    <DropdownMenu.Item asChild>
                                      <a
                                        href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="digital-dropdown-item"
                                      >
                                        <BadgeCheck size={15} color="#38bdf8" />
                                        <span>Validar Documento Oficial</span>
                                      </a>
                                    </DropdownMenu.Item>

                                    <div className="digital-dropdown-separator" />

                                    {/* Excluir Documento */}
                                    <DropdownMenu.Item asChild>
                                      <div
                                        onClick={() => handleExcluirContrato(c.id, c.protocolo, c.titulo_documento)}
                                        className="digital-dropdown-item danger"
                                        style={{ cursor: excluindoId === c.id ? 'wait' : 'pointer' }}
                                      >
                                        {excluindoId === c.id ? (
                                          <Loader2 size={15} className="animate-spin" color="#ef4444" />
                                        ) : (
                                          <Trash2 size={15} color="#ef4444" />
                                        )}
                                        <span>Excluir Documento</span>
                                      </div>
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Paginação Desktop Ultra Moderna ── */}
        {!loading && contratos.length > 0 && (
          <DigitalPagination
            totalItens={contratos.length}
            limitePorPagina={limitePorPagina}
            paginaAtual={paginaAtual}
            onLimiteChange={handleMudarLimite}
            onPaginaChange={handleMudarPagina}
          />
        )}
      </div>

      {/* ── Lista Mobile de Documentos (Cards Otimizados) ── */}
      <div className="digital-mobile-list">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-surface))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
            <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
            <span style={{ fontSize: 13 }}>Carregando documentos para assinatura...</span>
          </div>
        ) : fetchError ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-surface))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
            <AlertCircle size={28} style={{ margin: '0 auto 8px', color: '#ef4444', display: 'block' }} />
            <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Erro ao carregar documentos</div>
            <div style={{ fontSize: 12, marginBottom: 12 }}>{fetchError}</div>
            <button
              onClick={() => carregarContratos()}
              style={{ padding: '6px 14px', background: 'hsl(var(--primary))', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Tentar novamente
            </button>
          </div>
        ) : contratos.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-surface))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
            <FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.4, display: 'block' }} />
            <div style={{ fontSize: 13 }}>
              {anoFiltro && anoFiltro !== 'todos' ? (
                <>
                  Nenhum documento para o ano <strong>{anoFiltro}</strong>.
                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={() => {
                        anoAlteradoManualmenteRef.current = true
                        setAnoFiltro('todos')
                      }}
                      style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Ver todos os anos
                    </button>
                  </div>
                </>
              ) : (
                'Nenhum documento localizado com os filtros selecionados.'
              )}
            </div>
          </div>
        ) : (
          contratosPaginados.map(c => {
            const isAssinado = c.status === 'assinado'
            const isCancelado = c.status === 'cancelado'
            const isPendente = c.status === 'pendente'

            return (
              <div
                key={`mob_${c.id}`}
                style={{
                  background: 'hsl(var(--bg-surface))',
                  border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: 14,
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                {/* Topo do Card: Protocolo e Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <a
                      href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                      target="_blank"
                      rel="noreferrer"
                      title={`Validar contrato ${c.protocolo}`}
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        fontSize: 12.5,
                        color: '#38bdf8',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        borderBottom: '1px dashed rgba(56, 189, 248, 0.45)',
                        paddingBottom: 1,
                      }}
                    >
                      {c.protocolo}
                      <ExternalLink size={10} style={{ opacity: 0.7 }} />
                    </a>
                    <button
                      onClick={() => {
                        copiarTextoComFeedback(c.protocolo, () => {
                          setCopiadoProtocoloId(c.protocolo)
                          toast.success(`Protocolo ${c.protocolo} copiado!`)
                          setTimeout(() => setCopiadoProtocoloId(null), 2000)
                        })
                      }}
                      title={copiadoProtocoloId === c.protocolo ? 'Protocolo copiado!' : 'Copiar Protocolo'}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiadoProtocoloId === c.protocolo ? '#10b981' : 'hsl(var(--text-secondary))',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      {copiadoProtocoloId === c.protocolo ? (
                        <Check size={12} style={{ strokeWidth: 3 }} />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>

                  {/* Badge de Status */}
                  <div>
                    {isAssinado ? (
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CheckCircle2 size={12} /> Assinado
                      </span>
                    ) : isCancelado ? (
                      <span
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <AlertCircle size={12} /> Cancelado
                      </span>
                    ) : (
                      <span
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Clock size={12} /> Pendente
                      </span>
                    )}
                  </div>
                </div>

                {/* Título do Documento e Tags */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'hsl(var(--text-primary))', lineHeight: 1.3 }}>
                    {c.titulo_documento}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, color: 'hsl(var(--text-secondary))' }}>
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    {(c.evidencias as any)?.totalDocumentos > 1 && (
                      <span
                        title={`Pacote com ${(c.evidencias as any).totalDocumentos} documentos mesclados`}
                        style={{
                          fontSize: 9.5,
                          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(99, 102, 241, 0.18) 100%)',
                          color: '#38bdf8',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 700,
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <Layers size={9} /> {(c.evidencias as any).totalDocumentos} docs
                      </span>
                    )}
                    {c.ano_letivo && (
                      <span style={{ fontSize: 10, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                        Ano {c.ano_letivo}
                      </span>
                    )}
                    {c.aluno_nome && (
                      <span style={{ fontSize: 10, background: 'rgba(59, 130, 246, 0.12)', color: '#93c5fd', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        Aluno: {c.aluno_nome}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dados do Signatário */}
                <div
                  style={{
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 11.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                    👤 {c.responsavel_nome}
                  </div>
                  <div style={{ color: 'hsl(var(--text-secondary))', fontSize: 11 }}>
                    {c.responsavel_email}
                  </div>
                  {(c.responsavel_cpf || c.responsavel_telefone) && (
                    <div style={{ color: '#64748b', fontSize: 10.5 }}>
                      {c.responsavel_cpf ? `CPF: ${c.responsavel_cpf}` : ''}{c.responsavel_cpf && c.responsavel_telefone ? ' • ' : ''}{c.responsavel_telefone}
                    </div>
                  )}
                </div>

                {/* Ações Específicas Mobile Ultra Modernas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {/* 1. SE ASSINADO */}
                  {isAssinado && (
                    <>
                      {/* Botão Baixar Doc Assinado (Destaque Total) */}
                      <button
                        onClick={() => handleBaixarPdf(c, 'assinado')}
                        disabled={baixandoPdfId === `${c.id}_assinado`}
                        className="digital-action-btn digital-btn-primary"
                        style={{ height: 38, width: '100%', fontSize: 12.5 }}
                      >
                        {baixandoPdfId === `${c.id}_assinado` ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            <span>Baixando Documento...</span>
                          </>
                        ) : (
                          <>
                            <Download size={15} style={{ strokeWidth: 2.4 }} />
                            <span>Baixar Documento Assinado (PDF)</span>
                          </>
                        )}
                      </button>

                      {/* Linha de Ações Rápidas: WhatsApp + Dossiê + Menu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleCompartilharWhatsApp(c)}
                          className="digital-action-btn digital-btn-whatsapp"
                          style={{ flex: 1, height: 36 }}
                        >
                          <MessageSquare size={14} />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          onClick={() => setModalAuditoriaContrato(c)}
                          className="digital-action-btn digital-btn-dossie"
                          style={{ flex: 1, height: 36 }}
                        >
                          <ShieldCheck size={14} />
                          <span>Dossiê</span>
                        </button>

                        {/* Menu Mais Opções */}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="digital-btn-more"
                              style={{ width: 36, height: 36, flexShrink: 0 }}
                              title="Mais opções"
                              onClick={e => e.stopPropagation()}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenu.Trigger>

                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              side="bottom"
                              sideOffset={6}
                              className="digital-dropdown-content"
                              onClick={e => e.stopPropagation()}
                            >
                              <DropdownMenu.Item asChild>
                                <a
                                  href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="digital-dropdown-item"
                                >
                                  <BadgeCheck size={15} color="#38bdf8" />
                                  <span>Validar Assinatura Pública</span>
                                </a>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <div
                                  onClick={() => handleReenviarDocumentoEmail(c)}
                                  className="digital-dropdown-item"
                                  style={{ cursor: reenviandoEmailId === c.id ? 'wait' : 'pointer' }}
                                >
                                  {reenviandoEmailId === c.id ? (
                                    <Loader2 size={15} className="animate-spin" color="#38bdf8" />
                                  ) : (
                                    <Mail size={15} color="#38bdf8" />
                                  )}
                                  <span>Reenviar Cópia por E-mail</span>
                                </div>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <div
                                  onClick={() => handleCopiarLink(c.token_assinatura)}
                                  className="digital-dropdown-item"
                                >
                                  {copiadoTokenLink === c.token_assinatura ? (
                                    <Check size={15} color="#10b981" style={{ strokeWidth: 2.5 }} />
                                  ) : (
                                    <Copy size={15} color="#10b981" />
                                  )}
                                  <span>
                                    {copiadoTokenLink === c.token_assinatura ? 'Link Copiado!' : 'Copiar Link de Acesso'}
                                  </span>
                                </div>
                              </DropdownMenu.Item>

                              <div className="digital-dropdown-separator" />

                              <DropdownMenu.Item asChild>
                                <div
                                  onClick={() => handleExcluirContrato(c.id, c.protocolo, c.titulo_documento)}
                                  className="digital-dropdown-item danger"
                                  style={{ cursor: excluindoId === c.id ? 'wait' : 'pointer' }}
                                >
                                  {excluindoId === c.id ? (
                                    <Loader2 size={15} className="animate-spin" color="#ef4444" />
                                  ) : (
                                    <Trash2 size={15} color="#ef4444" />
                                  )}
                                  <span>Excluir Documento</span>
                                </div>
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </>
                  )}

                  {/* 2. SE PENDENTE */}
                  {isPendente && (
                    <>
                      {/* Linha 1: WhatsApp + Copiar Link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleCompartilharWhatsApp(c)}
                          className="digital-action-btn digital-btn-whatsapp-primary"
                          style={{ flex: 1, height: 38, fontSize: 12.5 }}
                        >
                          <MessageSquare size={14} />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          onClick={() => handleCopiarLink(c.token_assinatura)}
                          className={`digital-action-btn digital-btn-copy ${copiadoTokenLink === c.token_assinatura ? 'copied' : ''}`}
                          style={{ flex: 1, height: 38, fontSize: 12.5 }}
                        >
                          {copiadoTokenLink === c.token_assinatura ? (
                            <>
                              <Check size={14} style={{ strokeWidth: 2.5 }} />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Linha 2: Dossiê + Menu Mais Opções */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => setModalAuditoriaContrato(c)}
                          className="digital-action-btn digital-btn-dossie"
                          style={{ flex: 1, height: 36 }}
                        >
                          <ShieldCheck size={14} />
                          <span>Dossiê e Auditoria</span>
                        </button>

                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="digital-btn-more"
                              style={{ width: 36, height: 36, flexShrink: 0 }}
                              title="Mais opções"
                              onClick={e => e.stopPropagation()}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenu.Trigger>

                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              side="bottom"
                              sideOffset={6}
                              className="digital-dropdown-content"
                              onClick={e => e.stopPropagation()}
                            >
                              <DropdownMenu.Item asChild>
                                <div
                                  onClick={() => handleReenviarOtp(c)}
                                  className="digital-dropdown-item"
                                >
                                  <Mail size={15} color="#38bdf8" />
                                  <span>Reenviar Código OTP por E-mail</span>
                                </div>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <div
                                  onClick={() => handleBaixarPdf(c, 'original')}
                                  className="digital-dropdown-item"
                                  style={{ cursor: baixandoPdfId === `${c.id}_original` ? 'wait' : 'pointer' }}
                                >
                                  {baixandoPdfId === `${c.id}_original` ? (
                                    <Loader2 size={15} className="animate-spin" color="#94a3b8" />
                                  ) : (
                                    <Download size={15} color="#94a3b8" />
                                  )}
                                  <span>Baixar Minuta Original (PDF)</span>
                                </div>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <a
                                  href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="digital-dropdown-item"
                                >
                                  <BadgeCheck size={15} color="#38bdf8" />
                                  <span>Validar Documento Oficial</span>
                                </a>
                              </DropdownMenu.Item>

                              <div className="digital-dropdown-separator" />

                              <DropdownMenu.Item asChild>
                                <div
                                  onClick={() => handleCancelarContrato(c.id, c.protocolo)}
                                  className="digital-dropdown-item warning"
                                >
                                  <Ban size={15} color="#f59e0b" />
                                  <span>Revogar / Cancelar Link</span>
                                </div>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <div
                                  onClick={() => handleExcluirContrato(c.id, c.protocolo, c.titulo_documento)}
                                  className="digital-dropdown-item danger"
                                  style={{ cursor: excluindoId === c.id ? 'wait' : 'pointer' }}
                                >
                                  {excluindoId === c.id ? (
                                    <Loader2 size={15} className="animate-spin" color="#ef4444" />
                                  ) : (
                                    <Trash2 size={15} color="#ef4444" />
                                  )}
                                  <span>Excluir Documento</span>
                                </div>
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </>
                  )}

                  {/* 3. SE CANCELADO */}
                  {isCancelado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setModalAuditoriaContrato(c)}
                        className="digital-action-btn digital-btn-dossie"
                        style={{ flex: 1, height: 36 }}
                      >
                        <ShieldCheck size={14} />
                        <span>Dossiê e Auditoria</span>
                      </button>

                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className="digital-btn-more"
                            style={{ width: 36, height: 36, flexShrink: 0 }}
                            title="Mais opções"
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            side="bottom"
                            sideOffset={6}
                            className="digital-dropdown-content"
                            onClick={e => e.stopPropagation()}
                          >
                            <DropdownMenu.Item asChild>
                              <a
                                href={`/validar-assinatura/${encodeURIComponent(c.protocolo)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="digital-dropdown-item"
                              >
                                <BadgeCheck size={15} color="#38bdf8" />
                                <span>Validar Documento Oficial</span>
                              </a>
                            </DropdownMenu.Item>

                            <div className="digital-dropdown-separator" />

                            <DropdownMenu.Item asChild>
                              <div
                                onClick={() => handleExcluirContrato(c.id, c.protocolo, c.titulo_documento)}
                                className="digital-dropdown-item danger"
                                style={{ cursor: excluindoId === c.id ? 'wait' : 'pointer' }}
                              >
                                {excluindoId === c.id ? (
                                  <Loader2 size={15} className="animate-spin" color="#ef4444" />
                                ) : (
                                  <Trash2 size={15} color="#ef4444" />
                                )}
                                <span>Excluir Documento</span>
                              </div>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Paginação Mobile Ultra Moderna ── */}
      {!loading && contratos.length > 0 && (
        <div className="digital-mobile-pagination" style={{ marginTop: 12 }}>
          <DigitalPagination
            totalItens={contratos.length}
            limitePorPagina={limitePorPagina}
            paginaAtual={paginaAtual}
            onLimiteChange={handleMudarLimite}
            onPaginaChange={handleMudarPagina}
            style={{
              borderRadius: 14,
              border: '1px solid hsl(var(--border-subtle))',
            }}
          />
        </div>
      )}

      {/* ── MODAL DE NOVA EMISSÃO (SEM VALORES MONETÁRIOS) ── */}
      <AnimatePresence>
        {modalNovoAberto && (
          <div
            className="digital-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(7, 11, 22, 0.82)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="digital-modal-content digital-modal-novo-pro"
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid rgba(59, 130, 246, 0.28)',
                borderRadius: 24,
                maxWidth: 820,
                width: '100%',
                maxHeight: 'calc(94vh - 20px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 32px 80px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                position: 'relative',
              }}
            >
              {/* Barra superior de gradiente ultra moderno */}
              <div
                style={{
                  height: 3,
                  width: '100%',
                  background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 35%, #06b6d4 70%, #10b981 100%)',
                  flexShrink: 0,
                }}
              />

              {/* Header do Modal (Fixo) */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.04) 0%, transparent 100%)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: '0 8px 18px -4px rgba(37, 99, 235, 0.45)',
                      flexShrink: 0,
                    }}
                  >
                    <FileCheck2 size={22} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>
                        Emissão de Documento Digital
                      </h2>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(37, 99, 235, 0.12)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.28)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Lock size={10} /> LEI 14.063 / OTP
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', margin: '3px 0 0', lineHeight: 1.35 }}>
                      Envie contratos, termos e declarações com assinatura eletrônica e validação jurídica.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalNovoAberto(false)
                    setContratoCriadoSucesso(null)
                    setCopiadoModalLink(false)
                  }}
                  style={{
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    padding: 8,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'
                    e.currentTarget.style.color = '#ef4444'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
                    e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                    e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                  }}
                  title="Fechar modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sucesso na Emissão */}
              {contratoCriadoSucesso ? (
                <div className="digital-modal-scroll" style={{ padding: '36px 28px', textAlign: 'center', overflowY: 'auto', flex: 1 }}>
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.05) 70%)',
                      border: '2px solid #10b981',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      boxShadow: '0 0 24px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <CheckCircle2 size={38} />
                  </div>
                  <h3 style={{ fontSize: 21, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                    {contratoCriadoSucesso.modo_envio === 'separados' && (contratoCriadoSucesso.itens?.length ?? 0) > 1
                      ? `${contratoCriadoSucesso.total || contratoCriadoSucesso.itens?.length} Documentos Emitidos com Sucesso!`
                      : 'Documento Emitido com Sucesso!'}
                  </h3>

                  {contratoCriadoSucesso.modo_envio === 'separados' && (contratoCriadoSucesso.itens?.length ?? 0) > 1 ? (
                    <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', margin: '0 0 20px' }}>
                      Cada documento foi gerado com protocolo e link de assinatura individual para o signatário.
                    </p>
                  ) : (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', margin: '0 0 6px' }}>
                        Protocolo de Rastreabilidade: <strong style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 13, background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(56, 189, 248, 0.25)' }}>{contratoCriadoSucesso.contrato?.protocolo}</strong>
                      </p>
                      {(contratoCriadoSucesso.totalDocumentos ?? 0) > 1 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(37, 99, 235, 0.12)',
                            color: '#2563eb',
                            border: '1px solid rgba(37, 99, 235, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            marginTop: 4,
                          }}
                        >
                          <Layers size={13} /> Pacote com {contratoCriadoSucesso.totalDocumentos} documentos unificados
                        </span>
                      )}
                    </div>
                  )}

                  {/* Lista de Documentos Emitidos (Modo Separados) */}
                  {contratoCriadoSucesso.modo_envio === 'separados' && Array.isArray(contratoCriadoSucesso.itens) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, textAlign: 'left' }}>
                      {contratoCriadoSucesso.itens.map((item: any, idx: number) => {
                        const effectiveItemSignUrl =
                          typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                            ? item.signUrl.replace(/https?:\/\/[^\/]+/, window.location.origin)
                            : item.signUrl
                        const isCopiado = copiadoModalLink === item.id || copiadoModalLink === item.protocolo

                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              background: 'hsl(var(--bg-elevated))',
                              border: '1px solid hsl(var(--border-subtle))',
                              borderRadius: 14,
                              padding: '12px 16px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--text-primary))' }}>
                                📄 #{idx + 1} {item.titulo}
                              </div>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 7px', borderRadius: 6, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                {item.protocolo}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                type="text"
                                readOnly
                                value={effectiveItemSignUrl}
                                style={{
                                  flex: 1,
                                  height: 38,
                                  background: 'hsl(var(--bg-surface))',
                                  border: isCopiado ? '1.5px solid #10b981' : '1px solid hsl(var(--border-subtle))',
                                  borderRadius: 8,
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: isCopiado ? '#10b981' : '#38bdf8',
                                  outline: 'none',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  copiarTextoComFeedback(effectiveItemSignUrl, () => {
                                    setCopiadoModalLink(item.id || item.protocolo)
                                    toast.success(`Link de "${item.titulo}" copiado! 📋`)
                                    setTimeout(() => setCopiadoModalLink(false), 2500)
                                  })
                                }}
                                style={{
                                  background: isCopiado ? '#10b981' : 'hsl(var(--bg-surface))',
                                  border: isCopiado ? '1px solid #10b981' : '1px solid hsl(var(--border-subtle))',
                                  color: isCopiado ? '#fff' : 'hsl(var(--text-primary))',
                                  borderRadius: 8,
                                  padding: '0 14px',
                                  height: 38,
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  flexShrink: 0,
                                }}
                              >
                                {isCopiado ? <Check size={14} /> : <Copy size={13} />}
                                <span>{isCopiado ? 'Copiado!' : 'Copiar'}</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Caixa de Link Único (Modo Unificado ou Arquivo Único) */}
                  {(contratoCriadoSucesso.modo_envio !== 'separados' || !contratoCriadoSucesso.itens) && (
                    <div
                      style={{
                        background: 'hsl(var(--bg-elevated))',
                        borderRadius: 16,
                        padding: 18,
                        textAlign: 'left',
                        marginBottom: 24,
                        border: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                        Link Oficial de Assinatura & Ciência:
                      </div>
                      {(() => {
                        const effectiveSignUrl =
                          typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                            ? contratoCriadoSucesso.signUrl.replace(/https?:\/\/[^\/]+/, window.location.origin)
                            : contratoCriadoSucesso.signUrl
                        return (
                          <div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <input
                                type="text"
                                readOnly
                                value={effectiveSignUrl}
                                style={{
                                  flex: 1,
                                  height: 44,
                                  background: 'hsl(var(--bg-surface))',
                                  border: copiadoModalLink ? '1.5px solid #10b981' : '1px solid hsl(var(--border-subtle))',
                                  borderRadius: 10,
                                  padding: '0 14px',
                                  fontSize: 13,
                                  color: copiadoModalLink ? '#10b981' : '#38bdf8',
                                  transition: 'all 0.2s ease',
                                  outline: 'none',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  copiarTextoComFeedback(effectiveSignUrl, () => {
                                    setCopiadoModalLink(true)
                                    toast.success('Link copiado para a área de transferência! 📋')
                                    setTimeout(() => setCopiadoModalLink(false), 2500)
                                  })
                                }}
                                style={{
                                  background: copiadoModalLink ? '#10b981' : 'hsl(var(--bg-surface))',
                                  border: copiadoModalLink ? '1px solid #10b981' : '1px solid hsl(var(--border-subtle))',
                                  color: copiadoModalLink ? '#ffffff' : 'hsl(var(--text-primary))',
                                  borderRadius: 10,
                                  padding: '0 18px',
                                  height: 44,
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  minWidth: 110,
                                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                  transform: copiadoModalLink ? 'scale(1.03)' : 'scale(1)',
                                  boxShadow: copiadoModalLink ? '0 0 14px rgba(16, 185, 129, 0.4)' : 'none',
                                }}
                              >
                                {copiadoModalLink ? (
                                  <>
                                    <Check size={16} style={{ strokeWidth: 2.5 }} />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={15} />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <AnimatePresence>
                              {copiadoModalLink && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4, height: 0 }}
                                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                                  exit={{ opacity: 0, y: -4, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  style={{
                                    marginTop: 8,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <CheckCircle2 size={14} />
                                  <span>Link copiado com sucesso para a área de transferência!</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {(() => {
                      let effectiveWhatsappUrl = contratoCriadoSucesso.whatsappShareUrl || ''
                      if (
                        typeof window !== 'undefined' &&
                        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
                        contratoCriadoSucesso.signUrl
                      ) {
                        const localSignUrl = contratoCriadoSucesso.signUrl.replace(/https?:\/\/[^\/]+/, window.location.origin)
                        effectiveWhatsappUrl = effectiveWhatsappUrl
                          .replaceAll(encodeURIComponent(contratoCriadoSucesso.signUrl), encodeURIComponent(localSignUrl))
                          .replaceAll(contratoCriadoSucesso.signUrl, localSignUrl)
                      }
                      if (effectiveWhatsappUrl.includes('wa.me/')) {
                        effectiveWhatsappUrl = effectiveWhatsappUrl.replace(
                          /https:\/\/wa\.me\/(\d+)\?text=/,
                          'https://api.whatsapp.com/send/?phone=$1&text='
                        )
                      }
                      return (
                        <a
                          href={effectiveWhatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            textDecoration: 'none',
                            borderRadius: 12,
                            padding: '12px 22px',
                            fontWeight: 700,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                          }}
                        >
                          <MessageSquare size={16} /> Enviar no WhatsApp Agora
                        </a>
                      )
                    })()}
                    <button
                      type="button"
                      onClick={() => {
                        setModalNovoAberto(false)
                        setContratoCriadoSucesso(null)
                        setCopiadoModalLink(false)
                      }}
                      style={{
                        background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-subtle))',
                        color: 'hsl(var(--text-primary))',
                        borderRadius: 12,
                        padding: '12px 22px',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulário de Envio com Estrutura Fixo + Rolável */
                <form
                  onSubmit={handleCriarContrato}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* Conteúdo Rolável do Formulário */}
                  <div
                    className="digital-modal-scroll"
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '20px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      minHeight: 0,
                    }}
                  >
                  {/* ── 1. Upload de Múltiplos Arquivos PDF ou Word (Pacote Unificado ou Documentos Separados) ── */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setArrastandoArquivo(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setArrastandoArquivo(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setArrastandoArquivo(false)
                      const files = Array.from(e.dataTransfer.files || [])
                      if (files.length > 0) processarArquivosSelecionados(files)
                    }}
                    style={{
                      background: arrastandoArquivo
                        ? 'rgba(37, 99, 235, 0.12)'
                        : documentosUpload.length > 0
                        ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)'
                        : 'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(99, 102, 241, 0.02) 100%)',
                      border: arrastandoArquivo
                        ? '2px dashed #2563eb'
                        : documentosUpload.length > 0
                        ? '1.5px solid rgba(59, 130, 246, 0.3)'
                        : convertendoDocumento
                        ? '2px dashed #60a5fa'
                        : '1.5px dashed rgba(59, 130, 246, 0.35)',
                      borderRadius: 16,
                      padding: documentosUpload.length > 0 ? '14px 16px' : '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      boxShadow: arrastandoArquivo ? '0 0 24px rgba(37, 99, 235, 0.25)' : 'none',
                      flexShrink: 0,
                    }}
                  >
                    {/* Input file invisível com suporte a seleção de múltiplos arquivos */}
                    <input
                      id="input-multiplos-documentos-upload"
                      type="file"
                      multiple
                      disabled={convertendoDocumento}
                      accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />

                    {/* Feedback visual durante processamento/conversão de arquivos */}
                    {convertendoDocumento && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid rgba(37, 99, 235, 0.3)',
                          borderRadius: 10,
                          padding: '10px 14px',
                          color: '#2563eb',
                        }}
                      >
                        <Loader2 size={20} className="animate-spin" />
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                          {statusConversao || 'Processando e convertendo arquivos...'}
                        </div>
                      </div>
                    )}

                    {documentosUpload.length === 0 ? (
                      /* Estado 0: Nenhum arquivo selecionado */
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          gap: 14,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 14,
                              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(99, 102, 241, 0.12) 100%)',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                            }}
                          >
                            <Files size={24} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>
                                Selecionar Documento(s) (PDF ou Word)
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                                  color: '#2563eb',
                                  border: '1px solid rgba(37, 99, 235, 0.3)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Sparkles size={11} /> Múltiplos Arquivos Permitidos
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', marginTop: 3 }}>
                              Arraste um ou mais PDFs/Word (.docx) aqui, ou clique para escolher do computador
                            </div>
                          </div>
                        </div>

                        <label
                          htmlFor="input-multiplos-documentos-upload"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            padding: '9px 18px',
                            borderRadius: 10,
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: convertendoDocumento ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            transition: 'all 0.18s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                        >
                          <Upload size={14} />
                          <span>{convertendoDocumento ? 'Convertendo...' : 'Escolher Arquivo(s)'}</span>
                        </label>
                      </div>
                    ) : (
                      /* Estado 1+: Arquivos selecionados */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                        {/* Barra de cabeçalho do upload com métricas e ações */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 10,
                            paddingBottom: 8,
                            borderBottom: '1px solid hsl(var(--border-subtle))',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 800,
                                color: 'hsl(var(--text-primary))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Files size={16} color="#2563eb" />
                              {documentosUpload.length} {documentosUpload.length === 1 ? 'documento selecionado' : 'documentos selecionados'}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: 'rgba(37, 99, 235, 0.1)',
                                color: '#2563eb',
                                border: '1px solid rgba(37, 99, 235, 0.2)',
                              }}
                            >
                              Total: {totalTamanhoFormatadoGeral} • {totalPaginasGeral} {totalPaginasGeral === 1 ? 'pág' : 'págs'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label
                              htmlFor="input-multiplos-documentos-upload"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                background: 'rgba(37, 99, 235, 0.1)',
                                border: '1px solid rgba(37, 99, 235, 0.3)',
                                color: '#2563eb',
                                padding: '6px 12px',
                                borderRadius: 8,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title="Adicionar mais arquivos à lista"
                            >
                              <FilePlus2 size={13} /> + Adicionar Mais
                            </label>

                            <button
                              type="button"
                              onClick={handleLimparTodosDocumentos}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#ef4444',
                                padding: '6px 10px',
                                borderRadius: 8,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title="Remover todos os arquivos da lista"
                            >
                              <Trash2 size={13} /> Limpar
                            </button>
                          </div>
                        </div>

                        {/* Seletor de Modo de Envio (quando há 2 ou mais documentos) */}
                        {documentosUpload.length > 1 && (
                          <div
                            style={{
                              background: 'hsl(var(--bg-elevated))',
                              border: '1.5px solid rgba(59, 130, 246, 0.25)',
                              borderRadius: 12,
                              padding: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 8,
                              }}
                            >
                              <div style={{ fontSize: 11.5, fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Layers size={14} color="#2563eb" /> Formato de Envio dos {documentosUpload.length} Documentos:
                              </div>
                              <button
                                type="button"
                                onClick={handleAbrirPreviaPacoteUnificado}
                                disabled={gerandoPreviaPacote}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
                                  border: '1px solid rgba(56, 189, 248, 0.35)',
                                  color: '#0284c7',
                                  padding: '5px 11px',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: gerandoPreviaPacote ? 'not-allowed' : 'pointer',
                                }}
                                title="Visualizar prévia de todos os documentos consolidados em um só arquivo PDF"
                              >
                                {gerandoPreviaPacote ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                                Prévia do Pacote ({totalPaginasGeral} págs)
                              </button>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                gap: 8,
                              }}
                            >
                              {/* Opção 1: Pacote Unificado */}
                              <div
                                onClick={() => setModoEnvioMultiplo('unificado')}
                                style={{
                                  cursor: 'pointer',
                                  padding: '10px 12px',
                                  borderRadius: 10,
                                  border: modoEnvioMultiplo === 'unificado'
                                    ? '2px solid #2563eb'
                                    : '1px solid hsl(var(--border-subtle))',
                                  background: modoEnvioMultiplo === 'unificado'
                                    ? 'rgba(37, 99, 235, 0.08)'
                                    : 'hsl(var(--bg-surface))',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, color: modoEnvioMultiplo === 'unificado' ? '#2563eb' : 'hsl(var(--text-primary))' }}>
                                    <Layers size={14} /> Pacote Unificado
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      background: modoEnvioMultiplo === 'unificado' ? '#2563eb' : 'rgba(100,116,139,0.2)',
                                      color: modoEnvioMultiplo === 'unificado' ? '#ffffff' : 'hsl(var(--text-secondary))',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    Recomendado
                                  </span>
                                </div>
                                <div style={{ fontSize: 10.5, color: 'hsl(var(--text-secondary))', lineHeight: 1.35 }}>
                                  Mescla todos os documentos em 1 único arquivo sequencial. O responsável assina 1 única vez via link e código OTP.
                                </div>
                              </div>

                              {/* Opção 2: Documentos Separados */}
                              <div
                                onClick={() => setModoEnvioMultiplo('separados')}
                                style={{
                                  cursor: 'pointer',
                                  padding: '10px 12px',
                                  borderRadius: 10,
                                  border: modoEnvioMultiplo === 'separados'
                                    ? '2px solid #2563eb'
                                    : '1px solid hsl(var(--border-subtle))',
                                  background: modoEnvioMultiplo === 'separados'
                                    ? 'rgba(37, 99, 235, 0.08)'
                                    : 'hsl(var(--bg-surface))',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, color: modoEnvioMultiplo === 'separados' ? '#2563eb' : 'hsl(var(--text-primary))' }}>
                                    <Files size={14} /> Documentos Separados
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      background: modoEnvioMultiplo === 'separados' ? '#2563eb' : 'rgba(100,116,139,0.2)',
                                      color: modoEnvioMultiplo === 'separados' ? '#ffffff' : 'hsl(var(--text-secondary))',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    Lote
                                  </span>
                                </div>
                                <div style={{ fontSize: 10.5, color: 'hsl(var(--text-secondary))', lineHeight: 1.35 }}>
                                  Gera {documentosUpload.length} contratos independentes com links de assinatura e protocolos separados.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Lista de Documentos Selecionados */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            maxHeight: 280,
                            overflowY: 'auto',
                            paddingRight: 4,
                          }}
                        >
                          {documentosUpload.map((doc, idx) => {
                            const isDocx = doc.formatoOriginal === 'docx' || doc.formatoOriginal === 'doc'
                            return (
                              <div
                                key={doc.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: 10,
                                  background: 'hsl(var(--bg-surface))',
                                  border: '1px solid hsl(var(--border-subtle))',
                                  gap: 10,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                  {/* Posição e botões de reordenar */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span
                                      style={{
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        color: '#2563eb',
                                        background: 'rgba(37, 99, 235, 0.1)',
                                        padding: '2px 6px',
                                        borderRadius: 5,
                                        minWidth: 24,
                                        textAlign: 'center',
                                      }}
                                    >
                                      #{idx + 1}
                                    </span>
                                    {documentosUpload.length > 1 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoverDocumento(idx, 'cima')}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                            opacity: idx === 0 ? 0.25 : 0.8,
                                            lineHeight: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                          title="Mover para cima"
                                        >
                                          <ArrowUp size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === documentosUpload.length - 1}
                                          onClick={() => handleMoverDocumento(idx, 'baixo')}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            cursor: idx === documentosUpload.length - 1 ? 'not-allowed' : 'pointer',
                                            opacity: idx === documentosUpload.length - 1 ? 0.25 : 0.8,
                                            lineHeight: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                          title="Mover para baixo"
                                        >
                                          <ArrowDown size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Ícone do tipo */}
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      background: isDocx
                                        ? 'rgba(37, 99, 235, 0.15)'
                                        : 'rgba(16, 185, 129, 0.15)',
                                      color: isDocx ? '#2563eb' : '#059669',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <FileText size={16} />
                                  </div>

                                  {/* Nome e Metadados */}
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      title={doc.nome}
                                      style={{
                                        fontWeight: 700,
                                        fontSize: 12.5,
                                        color: 'hsl(var(--text-primary))',
                                        maxWidth: 300,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {doc.nome}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                      <span
                                        style={{
                                          fontSize: 9.5,
                                          fontWeight: 800,
                                          padding: '1px 5px',
                                          borderRadius: 4,
                                          background: isDocx ? 'rgba(37, 99, 235, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                          color: isDocx ? '#2563eb' : '#059669',
                                        }}
                                      >
                                        {doc.formatoOriginal.toUpperCase()}
                                      </span>
                                      <span style={{ fontSize: 10.5, color: 'hsl(var(--text-secondary))' }}>
                                        {doc.tamanhoFormatado} • {doc.totalPaginas} {doc.totalPaginas === 1 ? 'pág' : 'págs'}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 9.5,
                                          color: '#10b981',
                                          fontWeight: 600,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                        }}
                                        title={`Hash SHA-256: ${doc.hashSha256}`}
                                      >
                                        <CheckCircle2 size={10} /> SHA-256
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Ações do arquivo */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirPreviaIndividual(doc)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: 'rgba(56, 189, 248, 0.12)',
                                      border: '1px solid rgba(56, 189, 248, 0.3)',
                                      color: '#0284c7',
                                      padding: '5px 9px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                    title="Visualizar documento"
                                  >
                                    <Eye size={12} /> Prévia
                                  </button>

                                  <a
                                    href={doc.pdfBase64}
                                    download={doc.nomeArquivoPdf || `${doc.nome.replace(/\.(docx?|pdf)$/i, '')}.pdf`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: 'rgba(37, 99, 235, 0.08)',
                                      border: '1px solid rgba(37, 99, 235, 0.2)',
                                      color: '#2563eb',
                                      padding: '5px 9px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      cursor: 'pointer',
                                    }}
                                    title="Baixar em PDF"
                                  >
                                    <Download size={12} />
                                  </a>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoverDocumento(doc.id)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      background: 'rgba(239, 68, 68, 0.08)',
                                      border: '1px solid rgba(239, 68, 68, 0.25)',
                                      color: '#ef4444',
                                      padding: '5px 7px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                    }}
                                    title="Remover documento da seleção"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 2. CARD DE REPRESENTANTE LEGAL / CNPJ EMISSOR (DESTAQUE VISUAL ULTRA MODERNO) ── */}
                  {(() => {
                    const listaRepresentantes =
                      Array.isArray(configData.representantes) && configData.representantes.length > 0
                        ? configData.representantes
                        : DEFAULT_REPRESENTANTES_INICIAIS

                    const repAtivo =
                      listaRepresentantes.find(r => r.id === formNovo.escola_representante_id) ||
                      listaRepresentantes[0] ||
                      {
                        id: 'rep_infantil_fundamental',
                        razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
                        cnpj: '04.395.789/0001-88',
                        nome: 'IVAN ROSSI SAMBRANA',
                        cargo: 'Representante Legal / Diretor Geral',
                        segmento: 'Ed. Infantil e Ens. Fund',
                      }

                    const rawSegmento = repAtivo.segmento || 'Ed. Infantil e Ens. Fund'
                    const segmentoBadgeTexto = rawSegmento === 'Educação Infantil e Ensino Fundamental' || rawSegmento.toLowerCase().includes('educação infantil')
                      ? 'Ed. Infantil e Ens. Fund'
                      : rawSegmento === 'Ensino Médio'
                        ? 'Ens. Médio'
                        : rawSegmento
                    const isInfantil =
                      segmentoBadgeTexto.toLowerCase().includes('infantil') ||
                      segmentoBadgeTexto.toLowerCase().includes('fundamental') ||
                      segmentoBadgeTexto.toLowerCase().includes('fund')

                    return (
                      <div
                        style={{
                          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.07) 0%, rgba(99, 102, 241, 0.05) 50%, rgba(6, 182, 212, 0.05) 100%)',
                          border: '1.5px solid rgba(59, 130, 246, 0.35)',
                          borderRadius: 16,
                          padding: '16px 18px',
                          position: 'relative',
                          boxShadow: '0 8px 24px -6px rgba(37, 99, 235, 0.15)',
                          flexShrink: 0,
                          minHeight: 'fit-content',
                          width: '100%',
                        }}
                      >
                        {/* Topo do Card: Título e Badge Proeminente */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                                flexShrink: 0,
                              }}
                            >
                              <Building2 size={18} />
                            </div>
                            <div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Representante Legal / CNPJ Emissor do Documento *
                              </label>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 1 }}>
                                Signatário Institucional Oficial da Instituição
                              </div>
                            </div>
                          </div>

                          {/* BADGE PROEMINENTE EM DESTAQUE */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                              color: '#ffffff',
                              padding: '5px 14px',
                              borderRadius: 999,
                              fontSize: 11.5,
                              fontWeight: 800,
                              letterSpacing: '0.02em',
                              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            {isInfantil ? <School size={14} /> : <GraduationCap size={14} />}
                            <span>{segmentoBadgeTexto}</span>
                          </div>
                        </div>

                        {/* Seletor Visual Rápido em Botões / Tabs de Segmento */}
                        {listaRepresentantes.length > 1 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 12 }}>
                            {listaRepresentantes.map(r => {
                              const isSelected = formNovo.escola_representante_id === r.id || (!formNovo.escola_representante_id && r.id === repAtivo.id)
                              const segTexto = r.segmento === 'Educação Infantil e Ensino Fundamental' || (r.segmento && r.segmento.toLowerCase().includes('educação infantil'))
                                ? 'Ed. Infantil e Ens. Fund'
                                : r.segmento === 'Ensino Médio'
                                  ? 'Ens. Médio'
                                  : (r.segmento || r.razaoSocial)
                              const isInfantilTab = (segTexto || '').toLowerCase().includes('infantil') || (segTexto || '').toLowerCase().includes('fundamental') || (segTexto || '').toLowerCase().includes('fund')
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => setFormNovo(prev => ({ ...prev, escola_representante_id: r.id }))}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    padding: '9px 14px',
                                    borderRadius: 10,
                                    background: isSelected
                                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                                      : 'hsl(var(--bg-surface))',
                                    border: isSelected
                                      ? '1.5px solid #2563eb'
                                      : '1px solid hsl(var(--border-subtle))',
                                    color: isSelected ? '#ffffff' : 'hsl(var(--text-secondary))',
                                    fontSize: 12,
                                    fontWeight: isSelected ? 800 : 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.18s ease',
                                    boxShadow: isSelected ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
                                    textAlign: 'left',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    {isInfantilTab ? <School size={14} style={{ flexShrink: 0 }} /> : <GraduationCap size={14} style={{ flexShrink: 0 }} />}
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {segTexto}
                                    </span>
                                  </div>
                                  {isSelected && <Check size={14} style={{ strokeWidth: 2.5, flexShrink: 0 }} />}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Caixa de Detalhes do Representante Selecionado */}
                        <div
                          style={{
                            background: 'hsl(var(--bg-surface))',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            borderRadius: 12,
                            padding: '12px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span>{repAtivo.razaoSocial}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                SIGNATÁRIO OFICIAL
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                                CNPJ: {repAtivo.cnpj}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'hsl(var(--text-secondary))', flexWrap: 'wrap' }}>
                            <span>
                              Signatário Legal: <strong style={{ color: 'hsl(var(--text-primary))' }}>{repAtivo.nome}</strong> ({repAtivo.cargo})
                            </span>
                            {repAtivo.telefone && (
                              <>
                                <span>•</span>
                                <span>📱 {repAtivo.telefone}</span>
                              </>
                            )}
                            {repAtivo.email && (
                              <>
                                <span>•</span>
                                <span>✉️ {repAtivo.email}</span>
                              </>
                            )}
                            {repAtivo.cidadeUf && (
                              <>
                                <span>•</span>
                                <span>📍 {repAtivo.cidadeUf}</span>
                              </>
                            )}
                          </div>

                          {/* Seletor Dropdown para Fácil Alternância de Múltiplos CNPJs */}
                          <div style={{ marginTop: 2, paddingTop: 8, borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                              Alterar signatário institucional:
                            </span>
                            <select
                              required
                              value={formNovo.escola_representante_id || repAtivo.id}
                              onChange={e => setFormNovo(prev => ({ ...prev, escola_representante_id: e.target.value }))}
                              className="digital-modal-input"
                              style={{
                                height: 32,
                                background: 'hsl(var(--bg-elevated))',
                                border: '1px solid hsl(var(--border-subtle))',
                                borderRadius: 8,
                                padding: '0 10px',
                                color: 'hsl(var(--text-primary))',
                                fontSize: 11.5,
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {listaRepresentantes.map(r => {
                                const segNome = r.segmento === 'Educação Infantil e Ensino Fundamental' || (r.segmento && r.segmento.toLowerCase().includes('educação infantil'))
                                  ? 'Ed. Infantil e Ens. Fund'
                                  : r.segmento === 'Ensino Médio'
                                    ? 'Ens. Médio'
                                    : r.segmento
                                return (
                                  <option key={r.id} value={r.id}>
                                    {segNome ? `[${segNome}] ` : ''}{r.razaoSocial} • CNPJ: {r.cnpj} ({r.nome})
                                  </option>
                                )
                              })}
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── 3. Título do Documento e Seleção de Ano Letivo ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, flexShrink: 0 }}>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <FileText size={13} color="#2563eb" /> Título do Documento *
                      </label>
                      <input
                        type="text"
                        required
                        value={formNovo.titulo_documento}
                        onChange={e => setFormNovo({ ...formNovo, titulo_documento: e.target.value })}
                        placeholder={`Ex: Termo de Adesão e Ciência Escolar ${formNovo.ano_letivo || ultimoAnoCadastrado}`}
                        className="digital-modal-input"
                        style={{
                          width: '100%',
                          height: 42,
                          background: 'hsl(var(--bg-surface))',
                          border: '1px solid hsl(var(--border-subtle))',
                          borderRadius: 10,
                          padding: '0 14px',
                          color: 'hsl(var(--text-primary))',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Calendar size={13} /> Ano Letivo *
                      </label>
                      <select
                        required
                        value={formNovo.ano_letivo}
                        onChange={e => setFormNovo({ ...formNovo, ano_letivo: e.target.value })}
                        className="digital-modal-input"
                        style={{
                          width: '100%',
                          height: 42,
                          background: 'hsl(var(--bg-surface))',
                          border: '1px solid hsl(var(--border-subtle))',
                          borderRadius: 10,
                          padding: '0 14px',
                          color: 'hsl(var(--text-primary))',
                          fontSize: 13,
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {anosLetivosDisponiveis.map(ano => (
                          <option key={ano} value={ano}>
                            {ano} {ano === ultimoAnoCadastrado ? '(Último Cadastrado)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── 4. Busca Inteligente de Aluno & Seleção de Responsável ── */}
                  <div
                    ref={searchContainerRef}
                    style={{
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(37, 99, 235, 0.03) 100%)',
                      borderRadius: 16,
                      padding: 16,
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} /> Atalho Inteligente: Buscar Aluno para Puxar Responsáveis (Opcional)
                      </label>
                      {alunoSelecionado && (
                        <button
                          type="button"
                          onClick={handleLimparAluno}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <X size={12} /> Desvincular Aluno
                        </button>
                      )}
                    </div>

                    {!alunoSelecionado ? (
                      <div style={{ position: 'relative' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'hsl(var(--bg-surface))',
                            border: dropdownAlunosAberto ? '1.5px solid #3b82f6' : '1px solid hsl(var(--border-subtle))',
                            borderRadius: 10,
                            padding: '0 14px',
                            transition: 'all 0.2s ease',
                            boxShadow: dropdownAlunosAberto ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
                          }}
                        >
                          <Search size={16} color="hsl(var(--text-secondary))" style={{ marginRight: 10, flexShrink: 0 }} />
                          <input
                            type="text"
                            value={buscaAlunoInput}
                            onChange={e => setBuscaAlunoInput(e.target.value)}
                            onFocus={() => {
                              if (alunosSugeridos.length > 0) setDropdownAlunosAberto(true)
                            }}
                            placeholder="Digite o nome, CPF ou matrícula do estudante..."
                            style={{
                              width: '100%',
                              height: 42,
                              background: 'transparent',
                              border: 'none',
                              color: 'hsl(var(--text-primary))',
                              fontSize: 13,
                              outline: 'none',
                            }}
                          />
                          {buscandoAlunos && (
                            <Loader2 size={16} className="animate-spin" color="#3b82f6" style={{ flexShrink: 0, marginLeft: 8 }} />
                          )}
                          {buscaAlunoInput && !buscandoAlunos && (
                            <button
                              type="button"
                              onClick={() => {
                                setBuscaAlunoInput('')
                                setAlunosSugeridos([])
                                setDropdownAlunosAberto(false)
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'hsl(var(--text-secondary))',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: 4,
                              }}
                              title="Limpar busca"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Dropdown de sugestões em tempo real */}
                        {dropdownAlunosAberto && (
                          <div
                            className="digital-modal-scroll"
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              zIndex: 50,
                              background: 'hsl(var(--bg-elevated))',
                              border: '1px solid hsl(var(--border-subtle))',
                              borderRadius: 12,
                              marginTop: 6,
                              maxHeight: 280,
                              overflowY: 'auto',
                              boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
                            }}
                          >
                            {alunosSugeridos.length > 0 ? (
                              <div>
                                <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(0,0,0,0.05)' }}>
                                  Estudantes Encontrados ({alunosSugeridos.length})
                                </div>
                                {alunosSugeridos.map(a => {
                                  const iniciais = (a.nome || 'AL')
                                    .split(' ')
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((p: string) => p[0].toUpperCase())
                                    .join('')
                                  const respPreview = a.responsavelFinanceiro || a.responsavel_financeiro || a.responsavel || a.dados?.maeNome || a.dados?.paiNome || ''
                                  return (
                                    <div
                                      key={a.id}
                                      onClick={() => handleSelecionarAluno(a)}
                                      style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid hsl(var(--border-subtle))',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                        transition: 'background 0.15s ease',
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div
                                          style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            flexShrink: 0,
                                          }}
                                        >
                                          {iniciais}
                                        </div>
                                        <div>
                                          <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', fontSize: 13 }}>
                                            {a.nome}
                                          </div>
                                          <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                            <span>{getNomeTurma(a)}</span>
                                            {a.matricula && <span>• Matrícula: {a.matricula}</span>}
                                          </div>
                                        </div>
                                      </div>

                                      {respPreview && (
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: '#2563eb',
                                            background: 'rgba(37, 99, 235, 0.1)',
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            border: '1px solid rgba(37, 99, 235, 0.2)',
                                            whiteSpace: 'nowrap',
                                            maxWidth: 180,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            fontWeight: 600,
                                          }}
                                        >
                                          👤 {respPreview}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div style={{ padding: 24, textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: 12 }}>
                                {buscandoAlunos ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Loader2 size={16} className="animate-spin" color="#3b82f6" />
                                    <span>Buscando estudantes no sistema...</span>
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>
                                      Nenhum estudante encontrado com "{buscaAlunoInput}"
                                    </div>
                                    <div style={{ fontSize: 11 }}>
                                      Você pode preencher os dados do signatário diretamente nos campos abaixo.
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Card do Aluno Selecionado */
                      <div
                        style={{
                          background: 'hsl(var(--bg-surface))',
                          border: '1.5px solid rgba(59, 130, 246, 0.35)',
                          borderRadius: 12,
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {(alunoSelecionado.nome || 'AL')
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p: string) => p[0].toUpperCase())
                              .join('')}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                              {alunoSelecionado.nome}
                            </div>
                            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                              Turma: <strong style={{ color: '#2563eb' }}>{getNomeTurma(alunoSelecionado)}</strong>
                              {alunoSelecionado.matricula && ` • Matrícula: ${alunoSelecionado.matricula}`}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleLimparAluno}
                          style={{
                            background: 'hsl(var(--bg-elevated))',
                            border: '1px solid hsl(var(--border-subtle))',
                            color: 'hsl(var(--text-secondary))',
                            borderRadius: 8,
                            padding: '7px 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#ef4444'
                            e.currentTarget.style.borderColor = '#ef4444'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                            e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                          }}
                        >
                          <RefreshCw size={13} /> Trocar Aluno
                        </button>
                      </div>
                    )}

                    {/* Seleção do Signatário / Responsável */}
                    {alunoSelecionado && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(99, 102, 241, 0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BadgeCheck size={16} color="#10b981" />
                            <span>Escolha o Responsável que Assinará o Documento:</span>
                            {responsaveisDisponiveis.length > 0 && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  color: '#059669',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  padding: '1px 8px',
                                  borderRadius: 999,
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                }}
                              >
                                {responsaveisDisponiveis.length} {responsaveisDisponiveis.length === 1 ? 'opção' : 'opções'}
                              </span>
                            )}
                          </div>
                          {carregandoResponsaveis && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3b82f6' }}>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Buscando responsáveis...</span>
                            </div>
                          )}
                        </div>

                        {responsaveisDisponiveis.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {responsaveisDisponiveis.map((r, idx) => {
                              const isSelected = responsavelSelecionadoId === (r.id || r.nome) || formNovo.signatario_nome === r.nome

                              const tipoLower = (r.tipo || '').toLowerCase()
                              let badgeBg = 'rgba(59, 130, 246, 0.12)'
                              let badgeColor = '#2563eb'
                              let badgeBorder = 'rgba(59, 130, 246, 0.28)'
                              let avatarGradient = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                              let tagText = r.tipo || 'RESPONSÁVEL'

                              if (tipoLower.includes('mãe') || tipoLower.includes('mae')) {
                                badgeBg = 'rgba(168, 85, 247, 0.12)'
                                badgeColor = '#9333ea'
                                badgeBorder = 'rgba(168, 85, 247, 0.28)'
                                avatarGradient = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                                tagText = 'MÃE'
                              } else if (tipoLower.includes('pai')) {
                                badgeBg = 'rgba(37, 99, 235, 0.12)'
                                badgeColor = '#2563eb'
                                badgeBorder = 'rgba(59, 130, 246, 0.28)'
                                avatarGradient = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                                tagText = 'PAI'
                              } else if (tipoLower.includes('financeiro')) {
                                badgeBg = 'rgba(16, 185, 129, 0.12)'
                                badgeColor = '#059669'
                                badgeBorder = 'rgba(16, 185, 129, 0.28)'
                                avatarGradient = 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                                tagText = 'FINANCEIRO'
                              } else if (tipoLower.includes('pedagógico') || tipoLower.includes('pedagogico')) {
                                badgeBg = 'rgba(245, 158, 11, 0.12)'
                                badgeColor = '#d97706'
                                badgeBorder = 'rgba(245, 158, 11, 0.28)'
                                avatarGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                tagText = 'PEDAGÓGICO'
                              }

                              const iniciais = (r.nome || 'R')
                                .split(' ')
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((p: string) => p[0].toUpperCase())
                                .join('')

                              return (
                                <div
                                  key={idx}
                                  onClick={() => selecionarResponsavel(r, alunoSelecionado)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: '9px 14px',
                                    borderRadius: 12,
                                    cursor: 'pointer',
                                    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: isSelected
                                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0%, rgba(37, 99, 235, 0.04) 100%)'
                                      : 'hsl(var(--bg-surface))',
                                    border: isSelected
                                      ? '1.5px solid #10b981'
                                      : '1px solid hsl(var(--border-subtle))',
                                    boxShadow: isSelected
                                      ? '0 4px 14px -2px rgba(16, 185, 129, 0.22)'
                                      : '0 1px 3px rgba(0, 0, 0, 0.02)',
                                  }}
                                  onMouseEnter={e => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.45)'
                                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.03)'
                                    }
                                  }}
                                  onMouseLeave={e => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                                      e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                                    }
                                  }}
                                >
                                  {/* Lado Esquerdo: Avatar + Nome + Tag de Parentesco + Contatos em Linha */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                    {/* Mini Avatar com Iniciais */}
                                    <div
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 10,
                                        background: avatarGradient,
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 12,
                                        fontWeight: 800,
                                        flexShrink: 0,
                                        boxShadow: isSelected
                                          ? '0 3px 8px rgba(16, 185, 129, 0.3)'
                                          : '0 2px 5px rgba(0, 0, 0, 0.08)',
                                      }}
                                    >
                                      {iniciais}
                                    </div>

                                    {/* Dados do Responsável em Linha Compacta */}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                        <span
                                          style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: 'hsl(var(--text-primary))',
                                            letterSpacing: '-0.01em',
                                          }}
                                        >
                                          {r.nome}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 9.5,
                                            fontWeight: 800,
                                            background: badgeBg,
                                            color: badgeColor,
                                            border: `1px solid ${badgeBorder}`,
                                            padding: '1px 6px',
                                            borderRadius: 999,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.03em',
                                          }}
                                        >
                                          {tagText}
                                        </span>
                                      </div>

                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          fontSize: 11,
                                          color: 'hsl(var(--text-secondary))',
                                          marginTop: 2,
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                        {r.telefone && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                            <span>📱</span>
                                            <strong style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{r.telefone}</strong>
                                          </span>
                                        )}
                                        {r.email && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.telefone && <span style={{ color: 'hsl(var(--text-muted))' }}>•</span>}
                                            <span>✉️</span>
                                            <span>{r.email}</span>
                                          </span>
                                        )}
                                        {r.cpf && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                            {(r.telefone || r.email) && <span style={{ color: 'hsl(var(--text-muted))' }}>•</span>}
                                            <span>🪪</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.cpf}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Lado Direito: Badge / Indicador de Seleção */}
                                  <div style={{ flexShrink: 0 }}>
                                    {isSelected ? (
                                      <div
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                          padding: '4px 11px',
                                          borderRadius: 999,
                                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                          color: '#ffffff',
                                          fontSize: 11,
                                          fontWeight: 800,
                                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                                          letterSpacing: '0.02em',
                                        }}
                                      >
                                        <Check size={12} style={{ strokeWidth: 2.8 }} />
                                        <span>Selecionado</span>
                                      </div>
                                    ) : (
                                      <div
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                          padding: '4px 10px',
                                          borderRadius: 999,
                                          background: 'hsl(var(--bg-elevated))',
                                          border: '1px solid hsl(var(--border-subtle))',
                                          color: 'hsl(var(--text-secondary))',
                                          fontSize: 11,
                                          fontWeight: 600,
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            border: '1.5px solid hsl(var(--text-muted))',
                                            display: 'inline-block',
                                          }}
                                        />
                                        <span>Escolher</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : !carregandoResponsaveis ? (
                          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 8, padding: 12, fontSize: 12, color: 'hsl(var(--text-secondary))', textAlign: 'center', border: '1px solid hsl(var(--border-subtle))' }}>
                            Nenhum responsável cadastrado diretamente para este aluno. Preencha os dados do signatário abaixo.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* ── 5. Dados do Signatário (100% Editáveis com Visual Sofisticado) ── */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(37, 99, 235, 0.03) 100%)',
                      padding: '18px 20px',
                      borderRadius: 16,
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={15} /> Dados do Signatário da Assinatura (Totalmente Editável)
                      </div>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                        Pessoa física que receberá e assinará o documento com código OTP
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 5 }}>
                          NOME COMPLETO DO SIGNATÁRIO *
                        </label>
                        <input
                          type="text"
                          required
                          value={formNovo.signatario_nome}
                          onChange={e => setFormNovo({ ...formNovo, signatario_nome: e.target.value })}
                          placeholder="Nome da pessoa que irá assinar"
                          className="digital-modal-input"
                          style={{ width: '100%', height: 40, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '0 12px', color: 'hsl(var(--text-primary))', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 5 }}>
                          E-MAIL (RECEBE CÓDIGO OTP E CÓPIA) *
                        </label>
                        <input
                          type="email"
                          required
                          value={formNovo.signatario_email}
                          onChange={e => setFormNovo({ ...formNovo, signatario_email: e.target.value })}
                          placeholder="email@exemplo.com"
                          className="digital-modal-input"
                          style={{ width: '100%', height: 40, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '0 12px', color: 'hsl(var(--text-primary))', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 5 }}>
                          WHATSAPP / CELULAR
                        </label>
                        <input
                          type="text"
                          value={formNovo.signatario_telefone}
                          onChange={e => setFormNovo({ ...formNovo, signatario_telefone: formatarTelefone(e.target.value) })}
                          placeholder="(67) 99999-9999"
                          className="digital-modal-input"
                          style={{ width: '100%', height: 40, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '0 12px', color: 'hsl(var(--text-primary))', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 5 }}>
                          CPF DO SIGNATÁRIO
                        </label>
                        <input
                          type="text"
                          value={formNovo.signatario_cpf}
                          onChange={e => setFormNovo({ ...formNovo, signatario_cpf: formatarCpf(e.target.value) })}
                          placeholder="000.000.000-00"
                          className="digital-modal-input"
                          style={{ width: '100%', height: 40, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '0 12px', color: 'hsl(var(--text-primary))', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 5 }}>
                          DATA DE NASCIMENTO
                        </label>
                        <input
                          type="text"
                          value={formNovo.signatario_data_nascimento}
                          onChange={e => setFormNovo({ ...formNovo, signatario_data_nascimento: formatarData(e.target.value) })}
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          className="digital-modal-input"
                          style={{ width: '100%', height: 40, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '0 12px', color: 'hsl(var(--text-primary))', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 5 }}>
                          VÍNCULO / PAPEL
                        </label>
                        <input
                          type="text"
                          value={formNovo.signatario_cargo}
                          onChange={e => setFormNovo({ ...formNovo, signatario_cargo: e.target.value })}
                          placeholder="Ex: Mãe, Pai, Resp. Financeiro, etc."
                          className="digital-modal-input"
                          style={{ width: '100%', height: 40, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '0 12px', color: 'hsl(var(--text-primary))', fontSize: 13, outline: 'none' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 14, padding: '10px 14px', background: 'hsl(var(--bg-surface))', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
                      <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0 }} />
                      <span>Estes dados identificam formalmente o signatário perante a Lei Federal 14.063/2020. O código de segurança será enviado para o e-mail informado.</span>
                    </div>
                  </div>
                </div>

                {/* ── 6. Rodapé Fixo com Ações Proeminentes ── */}
                <div
                  style={{
                    flexShrink: 0,
                    padding: '14px 24px',
                    borderTop: '1px solid hsl(var(--border-subtle))',
                    background: 'hsl(var(--bg-surface))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                    <ShieldCheck size={14} color="#10b981" />
                    <span>Validade Jurídica • ICP-Brasil / OTP</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setModalNovoAberto(false)}
                      style={{
                        background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-subtle))',
                        color: 'hsl(var(--text-secondary))',
                        borderRadius: 10,
                        padding: '10px 18px',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--text-primary))')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={salvandoContrato}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 22px',
                        cursor: salvandoContrato ? 'not-allowed' : 'pointer',
                        fontSize: 13.5,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                        transition: 'all 0.18s ease',
                      }}
                      onMouseEnter={e => {
                        if (!salvandoContrato) e.currentTarget.style.filter = 'brightness(1.08)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.filter = 'none'
                      }}
                    >
                      {salvandoContrato ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" /> Processando Arquivo e Hashes...
                        </>
                      ) : (
                        <>
                          <Check size={15} /> Enviar Documento & Gerar Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE PRÉ-VISUALIZAÇÃO DO PDF CONVERTIDO ── */}
      <AnimatePresence>
        {modalPreviaPdfAberto && pdfUploadBase64 && (
          <div
            className="digital-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: 920,
                height: '88vh',
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.7)',
              }}
            >
              {/* Header do Preview */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(30, 41, 59, 0.7)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={20} color="#38bdf8" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span>{pdfUploadNome}</span>
                      {previaEhPacoteUnificado && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '1px 7px',
                            borderRadius: 4,
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Layers size={10} /> Pacote Unificado
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {previaEhPacoteUnificado
                        ? `Consolidação sequencial de ${documentosUpload.length} documentos • Total de ${totalPaginasGeral} páginas • ${pdfUploadTamanho}`
                        : formatoOriginalUpload === 'docx' || formatoOriginalUpload === 'doc'
                        ? `Documento Word (.${formatoOriginalUpload.toUpperCase()}) convertido para PDF de alta fidelidade • ${pdfUploadTamanho}`
                        : `Pré-visualização do PDF original pronto para assinatura eletrônica • ${pdfUploadTamanho}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <a
                    href={previewPdfBlobUrl || pdfUploadBase64}
                    download={pdfUploadNome || 'documento'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#f8fafc',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={13} /> Baixar PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => setModalPreviaPdfAberto(false)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: '#f8fafc',
                      padding: '7px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Se houver mais de 1 documento, exibe abas rápidas para alternar visualização no modal */}
              {documentosUpload.length > 1 && (
                <div
                  style={{
                    padding: '8px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(15, 23, 42, 0.96)',
                    overflowX: 'auto',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                    <Layers size={13} color="#38bdf8" /> Alternar:
                  </span>

                  {/* Aba Pacote Unificado */}
                  <button
                    type="button"
                    onClick={handleAbrirPreviaPacoteUnificado}
                    disabled={gerandoPreviaPacote}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: gerandoPreviaPacote ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      border: previaEhPacoteUnificado ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                      background: previaEhPacoteUnificado ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: previaEhPacoteUnificado ? '#38bdf8' : '#94a3b8',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Layers size={12} />
                    Pacote Unificado ({totalPaginasGeral} págs)
                  </button>

                  {/* Abas individuais para cada arquivo da lista */}
                  {documentosUpload.map((doc, idx) => {
                    const isAtivo = !previaEhPacoteUnificado && docPreviaAtivo?.id === doc.id
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleAbrirPreviaIndividual(doc)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 9px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: isAtivo ? 700 : 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          border: isAtivo ? '1px solid #2563eb' : '1px solid rgba(255,255,255,0.1)',
                          background: isAtivo ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255,255,255,0.04)',
                          color: isAtivo ? '#93c5fd' : '#cbd5e1',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'all 0.15s ease',
                        }}
                        title={doc.nome}
                      >
                        <span style={{ fontWeight: 800 }}>#{idx + 1}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.nome}
                        </span>
                        <span style={{ opacity: 0.7, fontSize: 10 }}>({doc.totalPaginas}p)</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Corpo do Preview: Visualizador de PDF de alta fidelidade */}
              <div style={{ flex: 1, width: '100%', background: '#1e293b', position: 'relative' }}>
                <iframe
                  src={`${previewPdfBlobUrl || pdfUploadBase64}#toolbar=1&navpanes=0`}
                  title="Prévia do PDF"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL DA TRILHA DE AUDITORIA & DOSSIÊ ── */}
      <AnimatePresence>
        {modalAuditoriaContrato && (
          <div
            className="digital-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="digital-modal-content"
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 20,
                maxWidth: 680,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))' }}>
                    Dossiê e Trilha de Auditoria
                  </h3>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Protocolo: <a
                      href={`/validar-assinatura/${encodeURIComponent(modalAuditoriaContrato.protocolo)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir Validação Pública Oficial"
                      style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {modalAuditoriaContrato.protocolo}
                      <ExternalLink size={11} />
                    </a></span>
                    {modalAuditoriaContrato.ano_letivo && (
                      <span style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                        Ano Letivo {modalAuditoriaContrato.ano_letivo}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setModalAuditoriaContrato(null)}
                  style={{ background: 'none', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Quadro de Chaves */}
                <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 12, padding: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 8 }}>
                    Hashes Criptográficos SHA-256
                  </div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>Hash Original (Pré-Assinatura):</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--text-primary))', wordBreak: 'break-all', marginBottom: 8 }}>
                    {modalAuditoriaContrato.documento_original_hash}
                  </div>
                  {modalAuditoriaContrato.documento_assinado_hash && (
                    <>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>Hash Selado Final:</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#10b981', wordBreak: 'break-all' }}>
                        {modalAuditoriaContrato.documento_assinado_hash}
                      </div>
                    </>
                  )}
                </div>

                {/* Documentos Integrantes do Pacote Unificado (se houver mais de 1 documento anexado) */}
                {Array.isArray((modalAuditoriaContrato.evidencias as any)?.documentosAnexados) &&
                  (modalAuditoriaContrato.evidencias as any).documentosAnexados.length > 1 && (
                    <div
                      style={{
                        background: 'hsl(var(--bg-elevated))',
                        borderRadius: 12,
                        padding: 16,
                        border: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#38bdf8',
                          textTransform: 'uppercase',
                          marginBottom: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Layers size={14} />
                        Documentos Integrantes do Pacote ({((modalAuditoriaContrato.evidencias as any).documentosAnexados.length)} Arquivos Mesclados)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {((modalAuditoriaContrato.evidencias as any).documentosAnexados as any[]).map((doc, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              borderRadius: 8,
                              background: 'hsl(var(--bg-surface))',
                              border: '1px solid hsl(var(--border-subtle))',
                              fontSize: 12,
                              gap: 12,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: '#38bdf8',
                                  fontSize: 11,
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  padding: '2px 7px',
                                  borderRadius: 5,
                                }}
                              >
                                #{idx + 1}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                                  {doc.nome}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'hsl(var(--text-secondary))', fontFamily: 'monospace', marginTop: 2 }}>
                                  SHA-256: {doc.hashSha256 || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                              {doc.paginasRange && (
                                <span style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                                  Páginas {doc.paginasRange}
                                </span>
                              )}
                              <span>{doc.tamanhoFormatado || ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Linha do Tempo dos Eventos */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 12 }}>
                    Cadeia de Custódia (Histórico Imutável de Eventos)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(modalAuditoriaContrato.historico_eventos || []).map((ev, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'hsl(var(--bg-elevated))',
                          borderRadius: 10,
                          padding: '12px 16px',
                          border: '1px solid hsl(var(--border-subtle))',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: 12 }}>{ev.evento}</span>
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                            {new Date(ev.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))', marginTop: 4 }}>
                          {ev.descricao}
                        </div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-secondary))', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                          <span>IP: {ev.ip || '127.0.0.1'}</span>
                          <span>Hash: {ev.hash ? ev.hash.substring(0, 16) + '...' : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rodapé de Ações do Modal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                  <button
                    onClick={() => handleExcluirContrato(modalAuditoriaContrato.id, modalAuditoriaContrato.protocolo, modalAuditoriaContrato.titulo_documento)}
                    disabled={excluindoId === modalAuditoriaContrato.id}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: excluindoId === modalAuditoriaContrato.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {excluindoId === modalAuditoriaContrato.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Excluir Arquivo / Documento
                  </button>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {modalAuditoriaContrato.status === 'assinado' && (
                      <button
                        onClick={() => handleReenviarDocumentoEmail(modalAuditoriaContrato)}
                        disabled={reenviandoEmailId === modalAuditoriaContrato.id}
                        title={`Reenviar Cópia do Contrato para ${modalAuditoriaContrato.responsavel_email}`}
                        style={{
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: reenviandoEmailId === modalAuditoriaContrato.id ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {reenviandoEmailId === modalAuditoriaContrato.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Mail size={14} />
                        )}
                        Reenviar E-mail
                      </button>
                    )}

                    <a
                      href={`/validar-assinatura/${encodeURIComponent(modalAuditoriaContrato.protocolo)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.25))',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <ShieldCheck size={14} />
                      Validação Pública
                      <ExternalLink size={12} />
                    </a>

                    <button
                      onClick={() => setModalAuditoriaContrato(null)}
                      style={{
                        background: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-subtle))',
                        color: 'hsl(var(--text-primary))',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE CONFIGURAÇÕES (REPRESENTANTE & SMTP) ── */}
      <AnimatePresence>
        {modalConfigAberto && (
          <div
            className="digital-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(5, 8, 16, 0.82)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="digital-modal-content"
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 24,
                maxWidth: 720,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 30px 70px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)' }}>
                    <Settings size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>
                      Configurações de Assinatura Eletrônica
                    </h3>
                    <p style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', margin: '2px 0 0' }}>
                      Gerencie CNPJs, representantes legais, logomarca oficial e parâmetros de envio
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalConfigAberto(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    padding: 8,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.color = 'hsl(var(--text-primary))'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                  }}
                  title="Fechar configurações"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSalvarConfig} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. Representantes Legais por CNPJ */}
                <div style={{ background: 'hsl(var(--bg-elevated))', padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={15} /> Representantes Legais & CNPJs Cadastrados
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const novoId = `rep_${Date.now()}`
                        const novoRep: RepresentanteConfigItem = {
                          id: novoId,
                          nome: 'IVAN ROSSI SAMBRANA',
                          cpf: '00130220167',
                          cargo: 'Representante Legal / Diretor Geral',
                          razaoSocial: 'NOVA RAZÃO SOCIAL LTDA',
                          cnpj: '00.000.000/0001-00',
                          email: 'direcao@colegioimpacto.net',
                          telefone: '(67) 99280-6464',
                          segmento: 'Novo Segmento',
                          padrao: false,
                        }
                        const novaLista = [...configData.representantes, novoRep]
                        setConfigData({
                          ...configData,
                          representantes: novaLista,
                        })
                        setRepConfigIndex(novaLista.length - 1)
                        toast.success('Novo representante adicionado para edição.')
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Plus size={13} /> Adicionar CNPJ / Representante
                    </button>
                  </div>

                  {/* Tabs dos Representantes Cadastrados */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {configData.representantes.map((rep, idx) => (
                      <button
                        key={rep.id || idx}
                        type="button"
                        onClick={() => setRepConfigIndex(idx)}
                        style={{
                          background: repConfigIndex === idx ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'hsl(var(--bg-surface))',
                          color: repConfigIndex === idx ? '#fff' : 'hsl(var(--text-secondary))',
                          border: repConfigIndex === idx ? '1px solid #3b82f6' : '1px solid hsl(var(--border-subtle))',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Building2 size={13} />
                        <span>{rep.segmento || rep.razaoSocial || `CNPJ ${rep.cnpj}`}</span>
                        <span style={{ opacity: 0.75, fontSize: 10 }}>({rep.cnpj})</span>
                      </button>
                    ))}
                  </div>

                  {/* Campos do Representante Ativo */}
                  {(() => {
                    const repAtivo = configData.representantes[repConfigIndex] || configData.representantes[0]
                    if (!repAtivo) return null
                    const updateRepField = (field: keyof RepresentanteConfigItem, val: any) => {
                      const updated = [...configData.representantes]
                      updated[repConfigIndex] = { ...updated[repConfigIndex], [field]: val }
                      setConfigData({
                        ...configData,
                        representantes: updated,
                        representante: updated[0],
                      })
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>RAZÃO SOCIAL *</label>
                            <input
                              type="text"
                              required
                              value={repAtivo.razaoSocial}
                              onChange={e => updateRepField('razaoSocial', e.target.value)}
                              placeholder="COLÉGIO IMPACTO CENTRO DE ENSINO LTDA"
                              style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>CNPJ *</label>
                            <input
                              type="text"
                              required
                              value={repAtivo.cnpj}
                              onChange={e => updateRepField('cnpj', e.target.value)}
                              placeholder="04.395.789/0001-88"
                              style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>SEGMENTO / DESCRIÇÃO</label>
                            <input
                              type="text"
                              value={repAtivo.segmento || ''}
                              onChange={e => updateRepField('segmento', e.target.value)}
                              placeholder="Ex: Ed. Infantil e Ens. Fund / Ens. Médio"
                              style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>NOME COMPLETO DO REPRESENTANTE *</label>
                            <input
                              type="text"
                              required
                              value={repAtivo.nome}
                              onChange={e => updateRepField('nome', e.target.value)}
                              style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>CPF DO REPRESENTANTE *</label>
                            <input
                              type="text"
                              required
                              value={repAtivo.cpf}
                              onChange={e => updateRepField('cpf', formatarCpf(e.target.value))}
                              style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>CARGO INSTITUCIONAL *</label>
                            <input
                              type="text"
                              required
                              value={repAtivo.cargo}
                              onChange={e => updateRepField('cargo', e.target.value)}
                              style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                            />
                          </div>
                        </div>

                        {configData.representantes.length > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Deseja realmente remover o representante do CNPJ ${repAtivo.cnpj}?`)) {
                                  const novaLista = configData.representantes.filter((_, i) => i !== repConfigIndex)
                                  setConfigData({
                                    ...configData,
                                    representantes: novaLista,
                                    representante: novaLista[0],
                                  })
                                  setRepConfigIndex(Math.max(0, repConfigIndex - 1))
                                  toast.info('Representante removido.')
                                }
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#f87171',
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Trash2 size={12} /> Remover este CNPJ
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* 2. Logomarca Oficial da Instituição */}
                <div style={{ background: 'hsl(var(--bg-elevated))', padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={15} /> Logomarca Oficial da Instituição (Dossiês, PDFs e Assinatura)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        width: 140,
                        height: 64,
                        borderRadius: 8,
                        background: '#0a0f1d',
                        border: '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 6,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={configData.logoUrl || '/logo-impacto-clean.png'}
                        alt="Logomarca Oficial"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label
                          style={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#fff',
                            padding: '8px 16px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                          }}
                        >
                          <Upload size={14} /> Enviar Logo
                          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
                        </label>
                        {configData.logoUrl && configData.logoUrl !== '/logo-impacto-clean.png' && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfigData({ ...configData, logoUrl: '/logo-impacto-clean.png' })
                              toast.info('Logomarca restaurada para o padrão do Colégio Impacto.')
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid hsl(var(--border-subtle))',
                              color: 'hsl(var(--text-secondary))',
                              padding: '8px 14px',
                              borderRadius: 8,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Restaurar Logo Padrão
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
                        A logomarca enviada é inserida com alta resolução no Certificado Oficial de Evidências com QR Code, no cabeçalho dos contratos e nas páginas de assinatura do responsável e validação pericial.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Servidor SMTP de E-mail (Locaweb) */}
                <div style={{ background: 'hsl(var(--bg-elevated))', padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={15} /> Servidor de E-mail SMTP (Envio de Códigos OTP e Cópias)
                      </div>
                      <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2 }}>
                        ✓ Parâmetros oficiais Locaweb recomendados: host email-ssl.com.br • porta 587 (STARTTLS • Entrega Rápida)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleAbrirDiagnostico('test_connection')}
                        disabled={!configData.smtp.host}
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#34d399',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Activity size={13} /> Testar Conexão
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAbrirDiagnostico('send_test_email')}
                        disabled={!configData.smtp.host}
                        style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          color: '#60a5fa',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Send size={13} /> Enviar E-mail de Teste
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>HOST SMTP *</label>
                      <input
                        type="text"
                        placeholder="email-ssl.com.br"
                        value={configData.smtp.host}
                        onChange={e => setConfigData({ ...configData, smtp: { ...configData.smtp, host: e.target.value } })}
                        style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>PORTA *</label>
                      <input
                        type="number"
                        placeholder="587"
                        value={configData.smtp.port}
                        onChange={e => setConfigData({ ...configData, smtp: { ...configData.smtp, port: Number(e.target.value) || 587 } })}
                        style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))', marginBottom: 4 }}>USUÁRIO / E-MAIL *</label>
                      <input
                        type="text"
                        placeholder="direcao@colegioimpacto.net"
                        value={configData.smtp.user}
                        onChange={e => setConfigData({ ...configData, smtp: { ...configData.smtp, user: e.target.value } })}
                        style={{ width: '100%', height: 36, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 6, padding: '0 8px', color: 'hsl(var(--text-primary))', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label style={{ display: 'block', fontSize: 11, color: 'hsl(var(--text-secondary))' }}>SENHA / APP PASSWORD</label>
                        {configData.smtp.pass ? (
                          <span style={{ fontSize: 10, color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={11} /> Salva no sistema
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'hsl(var(--text-secondary))', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            Não configurada
                          </span>
                        )}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={mostrarSenhaSmtp ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={configData.smtp.pass}
                          onChange={e => setConfigData({ ...configData, smtp: { ...configData.smtp, pass: e.target.value } })}
                          style={{
                            width: '100%',
                            height: 36,
                            background: 'hsl(var(--bg-surface))',
                            border: '1px solid hsl(var(--border-subtle))',
                            borderRadius: 6,
                            padding: '0 34px 0 8px',
                            color: 'hsl(var(--text-primary))',
                            fontSize: 13,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenhaSmtp(!mostrarSenhaSmtp)}
                          title={mostrarSenhaSmtp ? 'Ocultar senha' : 'Ver senha'}
                          style={{
                            position: 'absolute',
                            right: 6,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'hsl(var(--text-secondary))',
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {mostrarSenhaSmtp ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── SEÇÃO: MENSAGEM DE ENVIO PARA O WHATSAPP (NOTIFICAÇÃO DE ASSINATURA) ── */}
                <div
                  style={{
                    background: 'hsl(var(--bg-elevated))',
                    borderRadius: 16,
                    padding: 18,
                    border: '1px solid hsl(var(--border-subtle))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  {/* Topo da Seção */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MessageSquare size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                          MENSAGEM DE ENVIO PARA O WHATSAPP
                        </div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 1 }}>
                          Personalize o texto enviado para os pais e responsáveis ao emitir ou compartilhar documentos
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setConfigData(prev => ({ ...prev, whatsappTemplate: DEFAULT_WHATSAPP_DIGITAL_TEMPLATE }))
                          toast.info('Mensagem padrão restaurada.')
                        }}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#0284c7',
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Restaurar para a mensagem padrão oficial do Colégio Impacto"
                      >
                        <RefreshCw size={11} /> Restaurar Padrão
                      </button>

                      <button
                        type="button"
                        onClick={() => setMostrarPreviaWhatsapp(!mostrarPreviaWhatsapp)}
                        style={{
                          background: mostrarPreviaWhatsapp ? 'rgba(16, 185, 129, 0.15)' : 'hsl(var(--bg-surface))',
                          border: mostrarPreviaWhatsapp ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid hsl(var(--border-subtle))',
                          color: mostrarPreviaWhatsapp ? '#059669' : 'hsl(var(--text-secondary))',
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Alternar visualização da simulação do WhatsApp"
                      >
                        <Smartphone size={11} /> {mostrarPreviaWhatsapp ? 'Ocultar Prévia' : 'Ver Prévia'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!mostrarPreviaWhatsapp) setMostrarPreviaWhatsapp(true)
                          handleTestarEnvioWhatsApp()
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          color: '#ffffff',
                          padding: '5px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
                          transition: 'all 0.15s ease',
                        }}
                        title="Abrir WhatsApp para testar o envio desta mensagem"
                      >
                        <Send size={11} /> Testar Envio WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* Chips de Tags / Variáveis Dinâmicas */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Variáveis Dinâmicas Disponíveis:</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b' }}>(clique para inserir no texto)</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { tag: '{responsavel}', label: 'Nome do Responsável' },
                        { tag: '{documento}', label: 'Título do Documento' },
                        { tag: '{aluno}', label: 'Nome do Estudante' },
                        { tag: '{link_assinatura}', label: 'Link de Assinatura' },
                        { tag: '{email}', label: 'E-mail do Responsável' },
                        { tag: '{escola}', label: 'Nome da Escola' },
                        { tag: '{ano}', label: 'Ano Letivo' },
                        { tag: '{protocolo}', label: 'Protocolo' },
                      ].map((item) => (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => {
                            const textarea = document.getElementById('textarea-whatsapp-template') as HTMLTextAreaElement | null
                            if (textarea) {
                              const start = textarea.selectionStart || 0
                              const end = textarea.selectionEnd || 0
                              const currentVal = configData.whatsappTemplate || ''
                              const newVal = currentVal.substring(0, start) + item.tag + currentVal.substring(end)
                              setConfigData(prev => ({ ...prev, whatsappTemplate: newVal }))
                              setTimeout(() => {
                                textarea.focus()
                                textarea.setSelectionRange(start + item.tag.length, start + item.tag.length)
                              }, 10)
                            } else {
                              setConfigData(prev => ({
                                ...prev,
                                whatsappTemplate: (prev.whatsappTemplate || '') + ' ' + item.tag,
                              }))
                            }
                            toast.success(`Variável ${item.tag} inserida!`)
                          }}
                          style={{
                            background: 'hsl(var(--bg-surface))',
                            border: '1px solid hsl(var(--border-subtle))',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            color: '#2563eb',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            transition: 'all 0.15s ease',
                          }}
                          title={`Clique para inserir ${item.tag} (${item.label})`}
                        >
                          <span style={{ fontWeight: 800 }}>{item.tag}</span>
                          <span style={{ fontSize: 9.5, color: 'hsl(var(--text-secondary))', fontFamily: 'sans-serif' }}>({item.label})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campo de Texto para Edição do Template */}
                  <div style={{ position: 'relative' }}>
                    <textarea
                      id="textarea-whatsapp-template"
                      rows={7}
                      value={configData.whatsappTemplate}
                      onChange={e => setConfigData({ ...configData, whatsappTemplate: e.target.value })}
                      placeholder="Digite a mensagem padrão que será enviada aos responsáveis pelo WhatsApp..."
                      style={{
                        width: '100%',
                        background: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-subtle))',
                        borderRadius: 8,
                        padding: '10px 12px',
                        color: 'hsl(var(--text-primary))',
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 10.5, color: 'hsl(var(--text-secondary))' }}>
                      <span>Dica: Use quebras de linha normais para formatar os parágrafos do WhatsApp.</span>
                      <span>{(configData.whatsappTemplate || '').length} caracteres</span>
                    </div>
                  </div>

                  {/* Painel de Teste de Envio Rápido do WhatsApp */}
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.05)',
                      border: '1px dashed rgba(16, 185, 129, 0.35)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                        <Smartphone size={13} /> Testar Envio:
                      </div>
                      <input
                        type="text"
                        value={telefoneTesteWhatsapp}
                        onChange={e => setTelefoneTesteWhatsapp(e.target.value)}
                        placeholder="Telefone com DDD (ou vazio para escolher contato)"
                        style={{
                          flex: 1,
                          minWidth: 160,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid hsl(var(--border-subtle))',
                          background: 'hsl(var(--bg-surface))',
                          color: 'hsl(var(--text-primary))',
                          fontSize: 11.5,
                        }}
                      />
                      {configData.representantes?.[0]?.telefone && telefoneTesteWhatsapp !== configData.representantes[0].telefone && (
                        <button
                          type="button"
                          onClick={() => setTelefoneTesteWhatsapp(configData.representantes[0].telefone || '')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#0284c7',
                            fontSize: 10.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            whiteSpace: 'nowrap',
                          }}
                          title="Preencher com o telefone do representante"
                        >
                          Usar meu número
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleTestarEnvioWhatsApp()}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                        }}
                        title="Abrir WhatsApp com a mensagem formatada para teste"
                      >
                        <Send size={11} /> Disparar Teste WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const texto = gerarTextoMensagemTeste()
                          navigator.clipboard.writeText(texto)
                          toast.success('Texto formatado de teste copiado!')
                        }}
                        style={{
                          background: 'hsl(var(--bg-surface))',
                          border: '1px solid hsl(var(--border-subtle))',
                          color: 'hsl(var(--text-secondary))',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Copiar texto formatado de teste"
                      >
                        <Copy size={11} /> Copiar
                      </button>
                    </div>
                  </div>

                  {/* Simulação Visual do Balão do WhatsApp (Idêntica ao Print do Usuário) */}
                  {mostrarPreviaWhatsapp && (
                    <div
                      style={{
                        background: '#0b141a',
                        borderRadius: 12,
                        padding: '14px 16px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Smartphone size={13} /> Simulação em Tempo Real (WhatsApp)
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>Visualização aproximada no celular</span>
                      </div>

                      {/* Balão do WhatsApp */}
                      <div
                        style={{
                          alignSelf: 'flex-start',
                          maxWidth: '94%',
                          background: '#d9fdd3',
                          color: '#111b21',
                          borderRadius: '8px 8px 8px 2px',
                          padding: '10px 12px 6px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
                          fontSize: 12.5,
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          position: 'relative',
                        }}
                      >
                        {/* Header embutido do link do portal (link preview card) */}
                        <div
                          style={{
                            background: '#c7ebc1',
                            borderRadius: 6,
                            padding: '6px 8px',
                            marginBottom: 8,
                            fontSize: 11,
                            borderLeft: '3px solid #25d366',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: '#0f5132', fontSize: 11 }}>
                            Assinatura Digital: CONTRATO NV1 e NV2 2027 | Colégio Impacto
                          </div>
                          <div style={{ color: '#4a5568', fontSize: 10, marginTop: 1 }}>
                            Portal oficial de assinatura eletrônica do Colégio Impacto (Impacto EDU).
                          </div>
                          <div style={{ color: '#059669', fontSize: 9.5, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                            🔗 impacto-edu.net
                          </div>
                        </div>

                        {/* Corpo da mensagem simulada */}
                        <div style={{ fontSize: 12.5, color: '#111b21' }}>
                          {gerarTextoMensagemTeste()}
                        </div>

                        {/* Rodapé com hora e checks duplos */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 3,
                            marginTop: 4,
                            fontSize: 10,
                            color: '#667781',
                          }}
                        >
                          <span>08:11</span>
                          <span style={{ color: '#53bdeb', fontWeight: 800 }}>✓✓</span>
                        </div>
                      </div>

                      {/* Ação rápida dentro da simulação */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 8, marginTop: 2 }}>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                          💡 Mensagem renderizada em tempo real com dados de teste.
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTestarEnvioWhatsApp()}
                          style={{
                            background: '#25d366',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '5px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: '0 2px 6px rgba(37, 211, 102, 0.35)',
                          }}
                          title="Abrir WhatsApp agora com esta mensagem de teste"
                        >
                          <Send size={11} /> Testar no WhatsApp Agora
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setModalConfigAberto(false)}
                    style={{ background: 'transparent', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontSize: 13 }}
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoConfig}
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                  >
                    {salvandoConfig ? 'Salvando...' : 'Salvar Configurações'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL DO VERIFICADOR DE ARQUIVOS (SHA-256) ── */}
      <AnimatePresence>
        {modalVerificadorAberto && (
          <div
            className="digital-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(5, 8, 16, 0.82)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="digital-modal-content"
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 24,
                maxWidth: 640,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 30px 70px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)' }}>
                    <Fingerprint size={19} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>
                      Verificador Pericial de Arquivo PDF
                    </h3>
                    <p style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', margin: '2px 0 0' }}>
                      Validação criptográfica de integridade SHA-256
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalVerificadorAberto(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    padding: 8,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.color = 'hsl(var(--text-primary))'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                  }}
                  title="Fechar verificador"
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  border: '2px dashed hsl(var(--border-subtle))',
                  borderRadius: 14,
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'hsl(var(--bg-elevated))',
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  if (e.dataTransfer.files?.[0]) handleProcessarArquivoVerificador(e.dataTransfer.files[0])
                }}
              >
                <Fingerprint size={40} color="#60a5fa" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>
                  Arraste o arquivo PDF do contrato para validação
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginBottom: 16 }}>
                  O sistema calculará a impressão digital SHA-256 e atestará se o arquivo sofreu qualquer adulteração.
                </div>

                <label
                  style={{
                    display: 'inline-block',
                    background: '#3b82f6',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Selecionar Arquivo
                  <input
                    type="file"
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files?.[0]) handleProcessarArquivoVerificador(e.target.files[0])
                    }}
                  />
                </label>
              </div>

              {checandoArquivo && (
                <div style={{ marginTop: 16, textAlign: 'center', color: '#60a5fa', fontSize: 13 }}>
                  <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                  Calculando hash SHA-256 e conferindo com a base oficial...
                </div>
              )}

              {arquivoResultado && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 12,
                    background: arquivoResultado.valido ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: arquivoResultado.valido ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    color: arquivoResultado.valido ? '#34d399' : '#f87171',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {arquivoResultado.valido ? '✅ ARQUIVO AUTÊNTICO E INALTERADO' : '❌ HASH NÃO CORRESPONDE'}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: 'hsl(var(--text-primary))' }}>
                    {arquivoResultado.mensagem}
                  </div>
                  {arquivoResultado.protocolo && (
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 8 }}>
                      Protocolo Vinculado: <strong>{arquivoResultado.protocolo}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: 10, fontFamily: 'monospace', marginTop: 8, color: 'hsl(var(--text-secondary))', wordBreak: 'break-all' }}>
                    Hash SHA-256: {arquivoHashCalc}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL CENTRAL DE VALIDAÇÃO DE CONTRATOS & INTEGRIDADE DIGITAL ── */}
      <AnimatePresence>
        {modalValidacaoAberto && (
          <div
            className="digital-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setModalValidacaoAberto(false)
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 105,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.2 }}
              className="digital-modal-content"
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 22,
                maxWidth: 720,
                width: '100%',
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 30px rgba(16, 185, 129, 0.1)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header do Modal */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'hsl(var(--bg-elevated))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Validação Pericial & Integridade Jurídica
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))' }}>
                      Central de Validação de Contratos
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalValidacaoAberto(false)}
                  style={{
                    background: 'hsl(var(--bg-surface))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 8,
                    color: 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs de Navegação */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-elevated))',
                  padding: '0 24px',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setTabValidacao('protocolo')}
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    background: 'transparent',
                    color: tabValidacao === 'protocolo' ? '#34d399' : 'hsl(var(--text-secondary))',
                    borderBottom: tabValidacao === 'protocolo' ? '2px solid #10b981' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Search size={15} /> Consulta por Protocolo
                </button>

                <button
                  type="button"
                  onClick={() => setTabValidacao('arquivo')}
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    background: 'transparent',
                    color: tabValidacao === 'arquivo' ? '#34d399' : 'hsl(var(--text-secondary))',
                    borderBottom: tabValidacao === 'arquivo' ? '2px solid #10b981' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Fingerprint size={15} /> Verificador de Arquivo (SHA-256)
                </button>

                <button
                  type="button"
                  onClick={() => setTabValidacao('ajuda')}
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    background: 'transparent',
                    color: tabValidacao === 'ajuda' ? '#34d399' : 'hsl(var(--text-secondary))',
                    borderBottom: tabValidacao === 'ajuda' ? '2px solid #10b981' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Building2 size={15} /> Portal Público & Normas
                </button>
              </div>

              {/* Corpo das Tabs */}
              <div style={{ padding: '24px' }}>
                {/* ── TAB 1: CONSULTA POR PROTOCOLO ── */}
                {tabValidacao === 'protocolo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleValidarProtocoloNoModal()
                      }}
                      style={{ display: 'flex', gap: 10 }}
                    >
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search
                          size={16}
                          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }}
                        />
                        <input
                          type="text"
                          value={validacaoProtocoloInput}
                          onChange={(e) => setValidacaoProtocoloInput(e.target.value)}
                          placeholder="Digite o código do protocolo (ex: IMP-2027-857LE8) ou token"
                          style={{
                            width: '100%',
                            padding: '12px 14px 12px 42px',
                            borderRadius: 12,
                            border: '1px solid hsl(var(--border-subtle))',
                            background: 'hsl(var(--bg-elevated))',
                            color: 'hsl(var(--text-primary))',
                            fontSize: 14,
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={validandoProtocolo}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 12,
                          padding: '0 22px',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: validandoProtocolo ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {validandoProtocolo ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" /> Consultando...
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={16} /> Validar Documento
                          </>
                        )}
                      </button>
                    </form>

                    {/* Chips de Contratos Recentes para Consulta Instantânea */}
                    {contratos.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 8 }}>
                          Contratos Emitidos (Clique para consultar instantaneamente):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {contratos.slice(0, 6).map((c) => {
                            const isAss = c.status === 'assinado'
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setValidacaoProtocoloInput(c.protocolo)
                                  handleValidarProtocoloNoModal(c.protocolo)
                                }}
                                style={{
                                  background: isAss ? 'rgba(16, 185, 129, 0.12)' : 'hsl(var(--bg-elevated))',
                                  border: isAss ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid hsl(var(--border-subtle))',
                                  color: isAss ? '#34d399' : 'hsl(var(--text-primary))',
                                  borderRadius: 8,
                                  padding: '6px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isAss ? <CheckCircle2 size={12} color="#34d399" /> : <Clock size={12} color="#f59e0b" />}
                                {c.protocolo} • {c.responsavel_nome}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mensagem de Erro se não encontrado */}
                    {erroValidacaoModal && (
                      <div
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          padding: '14px 16px',
                          borderRadius: 12,
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                        <div>{erroValidacaoModal}</div>
                      </div>
                    )}

                    {/* Resultado da Validação */}
                    {resultadoValidacaoModal && (
                      <div
                        style={{
                          background: 'hsl(var(--bg-elevated))',
                          border: resultadoValidacaoModal.valido
                            ? '1px solid rgba(16, 185, 129, 0.4)'
                            : '1px solid hsl(var(--border-subtle))',
                          borderRadius: 16,
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 16,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                background: resultadoValidacaoModal.valido ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: resultadoValidacaoModal.valido ? '#34d399' : '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {resultadoValidacaoModal.valido ? <CheckCircle2 size={22} /> : <Clock size={22} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                                {resultadoValidacaoModal.statusDescricao}
                              </div>
                              <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                                Protocolo Oficial: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{resultadoValidacaoModal.protocolo}</strong>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <a
                              href={`/validar-assinatura/${resultadoValidacaoModal.protocolo}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                color: '#fff',
                                textDecoration: 'none',
                                borderRadius: 8,
                                padding: '8px 14px',
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                              }}
                            >
                              <ExternalLink size={14} /> Abrir Validação Pública Completa
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                handleDownloadPdf(
                                  resultadoValidacaoModal.pdfBase64 || '',
                                  `Documento_${resultadoValidacaoModal.protocolo}.pdf`
                                )
                              }}
                              style={{
                                background: 'hsl(var(--bg-surface))',
                                border: '1px solid hsl(var(--border-subtle))',
                                color: 'hsl(var(--text-primary))',
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Download size={14} /> Baixar PDF
                            </button>
                          </div>
                        </div>

                        {/* Detalhes do Documento */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 12 }}>
                          <div style={{ background: 'hsl(var(--bg-surface))', padding: '12px', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                            <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 2 }}>Documento:</span>
                            <strong style={{ color: 'hsl(var(--text-primary))' }}>{resultadoValidacaoModal.tituloDocumento}</strong>
                          </div>

                          <div style={{ background: 'hsl(var(--bg-surface))', padding: '12px', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                            <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 2 }}>Signatário / Responsável:</span>
                            <strong style={{ color: 'hsl(var(--text-primary))' }}>{resultadoValidacaoModal.responsavelNomeMascarado || resultadoValidacaoModal.responsavelNome || 'Cadastrado'}</strong>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>CPF: {resultadoValidacaoModal.responsavelCpfMascarado}</div>
                          </div>

                          <div style={{ background: 'hsl(var(--bg-surface))', padding: '12px', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                            <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 2 }}>Data de Assinatura:</span>
                            <strong style={{ color: '#34d399' }}>
                              {resultadoValidacaoModal.dataAssinatura ? new Date(resultadoValidacaoModal.dataAssinatura).toLocaleString('pt-BR') : 'Pendente'}
                            </strong>
                          </div>
                        </div>

                        {/* Hash SHA-256 */}
                        <div style={{ background: 'hsl(var(--bg-surface))', padding: '12px', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', fontSize: 11 }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Hash SHA-256 Selado: </span>
                          <span style={{ fontFamily: 'monospace', color: '#34d399', wordBreak: 'break-all' }}>
                            {resultadoValidacaoModal.documentoAssinadoHash || resultadoValidacaoModal.documentoOriginalHash}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 2: VERIFICADOR DE ARQUIVO ── */}
                {tabValidacao === 'arquivo' && (
                  <div>
                    <div
                      style={{
                        border: '2px dashed hsl(var(--border-subtle))',
                        borderRadius: 16,
                        padding: '36px 20px',
                        textAlign: 'center',
                        background: 'hsl(var(--bg-elevated))',
                      }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        if (e.dataTransfer.files?.[0]) handleProcessarArquivoVerificador(e.dataTransfer.files[0])
                      }}
                    >
                      <Fingerprint size={48} color="#34d399" style={{ margin: '0 auto 12px' }} />
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>
                        Arraste o arquivo PDF do contrato para validação instantânea
                      </div>
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginBottom: 20, maxWidth: 440, margin: '0 auto 20px' }}>
                        O sistema calculará a impressão digital SHA-256 localmente no seu navegador e atestará se o arquivo sofreu qualquer modificação após a selagem.
                      </div>

                      <label
                        style={{
                          display: 'inline-block',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          padding: '10px 22px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        Selecionar PDF do Computador
                        <input
                          type="file"
                          accept=".pdf"
                          style={{ display: 'none' }}
                          onChange={e => {
                            if (e.target.files?.[0]) handleProcessarArquivoVerificador(e.target.files[0])
                          }}
                        />
                      </label>
                    </div>

                    {checandoArquivo && (
                      <div style={{ marginTop: 20, textAlign: 'center', color: '#60a5fa', fontSize: 13 }}>
                        <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                        Calculando hash SHA-256 e conferindo com a base oficial...
                      </div>
                    )}

                    {arquivoResultado && (
                      <div
                        style={{
                          marginTop: 20,
                          padding: 18,
                          borderRadius: 14,
                          background: arquivoResultado.valido ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          border: arquivoResultado.valido ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                          color: arquivoResultado.valido ? '#34d399' : '#f87171',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {arquivoResultado.valido ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                          {arquivoResultado.valido ? 'ARQUIVO AUTÊNTICO E INALTERADO' : 'HASH NÃO CORRESPONDE'}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 6, color: 'hsl(var(--text-primary))' }}>
                          {arquivoResultado.mensagem}
                        </div>
                        {arquivoResultado.protocolo && (
                          <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span>Protocolo Vinculado: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{arquivoResultado.protocolo}</strong></span>
                            <a
                              href={`/validar-assinatura/${arquivoResultado.protocolo}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#38bdf8',
                                fontSize: 12,
                                fontWeight: 700,
                                textDecoration: 'underline',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <ExternalLink size={12} /> Abrir Página Pública
                            </a>
                          </div>
                        )}
                        <div style={{ fontSize: 10, fontFamily: 'monospace', marginTop: 10, color: 'hsl(var(--text-secondary))', wordBreak: 'break-all' }}>
                          Hash SHA-256 Calculado: {arquivoHashCalc}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 3: PORTAL PÚBLICO & LEGISLAÇÃO ── */}
                {tabValidacao === 'ajuda' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 14, padding: '18px', border: '1px solid hsl(var(--border-subtle))' }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                        Validade Jurídica & Eficácia Probatória
                      </h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                        Todos os contratos e documentos assinados na plataforma do Colégio Impacto possuem plena validade jurídica e eficácia probatória equivalente a documentos assinados em cartório, respaldados pela:
                      </p>
                      <ul style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 13, color: 'hsl(var(--text-primary))', lineHeight: 1.6 }}>
                        <li><strong>Medida Provisória nº 2.200-2/2001 (Art. 10, § 2º):</strong> Validade de assinaturas eletrônicas avançadas com manifestação expressa de vontade.</li>
                        <li><strong>Código Civil Brasileiro (Arts. 107, 219 e 221):</strong> Liberdade de forma dos atos jurídicos e força probante dos documentos particulares.</li>
                        <li><strong>Criptografia SHA-256 e Carimbo do Tempo:</strong> Prova matemática de inalterabilidade do arquivo e registro indelével da data/hora.</li>
                      </ul>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                      <a
                        href="/validar-assinatura"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#fff',
                          textDecoration: 'none',
                          borderRadius: 12,
                          padding: '14px 24px',
                          fontSize: 14,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 10,
                          boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
                        }}
                      >
                        <ExternalLink size={16} /> Acessar Portal Público de Validação (/validar-assinatura)
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <SmtpDiagnosticModal
        isOpen={modalDiagnosticoAberto}
        onClose={() => setModalDiagnosticoAberto(false)}
        initialMode={modoDiagnostico}
        smtpConfig={{
          host: configData.smtp.host,
          port: configData.smtp.port,
          secure: configData.smtp.secure,
          user: configData.smtp.user,
          pass: configData.smtp.pass,
          fromEmail: (configData.smtp as any).fromEmail || configData.smtp.from || configData.smtp.user,
          fromName: (configData.smtp as any).fromName || 'Colégio Impacto - Matrícula Digital',
        }}
      />
    </div>
  )
}
