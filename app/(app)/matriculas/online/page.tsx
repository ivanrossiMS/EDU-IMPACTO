'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'
import {
  FileSignature, Search, Send, CheckCircle2, Clock, XCircle, AlertCircle,
  RefreshCw, Copy, Check, ExternalLink, MessageSquare, Mail, ShieldCheck,
  User, Users, DollarSign, Calendar, FileText, Settings, Key, Eye, EyeOff,
  Download, ArrowRight, Sparkles, CheckSquare, Trash2, Smartphone, Monitor,
  Upload, FileUp, Paperclip, X, File, FileCheck, Layers, ChevronRight, Zap,
  BookOpen, Building2, Plus, Edit3
} from 'lucide-react'

export interface SignatarioEscola {
  id: string
  cnpj: string
  razaoSocial: string
  nomeRepresentante: string
  cpfRepresentante?: string
  email: string
  telefone: string
  cargo?: string
  isDefault?: boolean
}

export interface ArquivoAnexoItem {
  id: string
  nome: string
  tamanhoFormatado: string
  tamanhoBytes: number
  base64: string
}

interface AlunoBusca {
  id: string
  nome: string
  matricula?: string
  codigo?: string
  cpf?: string
  turma?: string
  turma_nome?: string
  serie?: string
  turno?: string
  data_nascimento?: string
  dataNascimento?: string
  foto?: string
  responsavel?: string
  responsavel_financeiro?: string
  responsavel_pedagogico?: string
  telefone?: string
}

interface ResponsavelOption {
  id: string
  nome: string
  cpf?: string
  email?: string
  telefone?: string
  celular?: string
  parentesco?: string
  isFinanceiro?: boolean
  isPedagogico?: boolean
}

interface ArquivoAnexo {
  nome: string
  tamanho: string
  base64: string
}

interface ContratoRecord {
  id: string
  aluno_id: string
  aluno_nome: string
  aluno_cpf?: string
  aluno_turma?: string
  aluno_serie?: string
  responsavel_id?: string
  responsavel_nome: string
  responsavel_cpf?: string
  responsavel_email?: string
  responsavel_telefone?: string
  responsavel_parentesco?: string
  ano_letivo: string
  tipo_documento: string
  zapsign_doc_token?: string
  zapsign_signer_token?: string
  zapsign_sign_url?: string
  zapsign_auth_mode?: string
  zapsign_status?: string
  status: 'rascunho' | 'enviado' | 'aguardando' | 'assinado' | 'recusado' | 'cancelado' | string
  original_file_url?: string
  signed_file_url?: string
  metadata?: any
  created_at: string
  updated_at?: string
}

export default function MatriculasOnlinePage() {
  const { turmas } = useData()

  // ── Abas Principais ──
  const [activeTab, setActiveTab] = useState<'emitir' | 'painel' | 'modelos' | 'config'>('emitir')

  // ── Feedback e Toasts ──
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 4000)
  }

  // ── 1. ESTADOS DE EMISSÃO SIMPLIFICADA ──
  const [searchAluno, setSearchAluno] = useState('')
  const [alunosSugeridos, setAlunosSugeridos] = useState<AlunoBusca[]>([])
  const [isSearchingAlunos, setIsSearchingAlunos] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [alunoSel, setAlunoSel] = useState<AlunoBusca | null>(null)

  const [responsaveisAluno, setResponsaveisAluno] = useState<ResponsavelOption[]>([])
  const [isLoadingResponsaveis, setIsLoadingResponsaveis] = useState(false)
  const [responsavelSel, setResponsavelSel] = useState<ResponsavelOption | null>(null)

  // Dados exclusivos do Signatário Responsável: Nome, CPF, Telefone e E-mail
  const [respNome, setRespNome] = useState('')
  const [respCpf, setRespCpf] = useState('')
  const [respTelefone, setRespTelefone] = useState('')
  const [respEmail, setRespEmail] = useState('')
  const [respParentesco, setRespParentesco] = useState('Responsável')

  // Arquivos Anexados (Multi-arquivos para assinatura)
  const [arquivosAnexados, setArquivosAnexados] = useState<ArquivoAnexoItem[]>([])
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [tituloDocumento, setTituloDocumento] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Assinatura pela Escola (Contrato Bilateral)
  const [assinarPelaEscola, setAssinarPelaEscola] = useState<boolean>(true)
  const [escolaSignatarioSelId, setEscolaSignatarioSelId] = useState<string>('')

  // Modal / Edição de Signatário da Escola (Aba Configurações)
  const [modalSignatarioEscolaAberto, setModalSignatarioEscolaAberto] = useState(false)
  const [signatarioEditando, setSignatarioEditando] = useState<SignatarioEscola | null>(null)
  const [formSignatario, setFormSignatario] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeRepresentante: '',
    cpfRepresentante: '',
    email: '',
    telefone: '',
    cargo: '',
    isDefault: false
  })

  // Canal de Validação e Envio ZapSign
  const [authMode, setAuthMode] = useState<'tokenWhatsapp' | 'tokenEmail'>('tokenWhatsapp')
  const [isSendingZapSign, setIsSendingZapSign] = useState(false)
  const [envioSucessoModal, setEnvioSucessoModal] = useState<{
    docToken: string
    signUrl: string
    whatsappLink?: string
    alunoNome: string
    respNome: string
    respCpf?: string
    nomeArquivo: string
    totalArquivos?: number
    escolaSignatario?: {
      nome: string
      cargo?: string
      razaoSocial?: string
      cnpj?: string
      cpf?: string
      signUrl?: string
      whatsappLink?: string
    }
  } | null>(null)

  // ── 2. ESTADOS DO PAINEL DE ASSINATURAS ──
  const [contratos, setContratos] = useState<ContratoRecord[]>([])
  const [isLoadingContratos, setIsLoadingContratos] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroAno, setFiltroAno] = useState<string>('')
  const [filtroBusca, setFiltroBusca] = useState<string>('')
  const [metrics, setMetrics] = useState({
    total: 0,
    aguardando: 0,
    assinados: 0,
    recusados: 0,
    taxaAssinatura: 0,
  })

  // Modal para Assinatura Presencial / Balcão
  const [modalAssinarUrl, setModalAssinarUrl] = useState<string | null>(null)
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null)
  const [contratoParaExcluir, setContratoParaExcluir] = useState<ContratoRecord | null>(null)
  const [isExcluindoContrato, setIsExcluindoContrato] = useState(false)

  // ── 3. ESTADOS DE CONFIGURAÇÃO DO ZAPSIGN ──
  const [zapConfig, setZapConfig] = useState<{
    apiToken: string
    sandbox: boolean
    authModePadrao: 'tokenWhatsapp' | 'tokenEmail'
    envioAutomaticoWhatsapp: boolean
    envioAutomaticoEmail: boolean
    signatariosEscola?: SignatarioEscola[]
  }>({
    apiToken: '',
    sandbox: false,
    authModePadrao: 'tokenWhatsapp',
    envioAutomaticoWhatsapp: true,
    envioAutomaticoEmail: false,
    signatariosEscola: [],
  })
  const [hasTokenConfigurado, setHasTokenConfigurado] = useState(false)
  const [showTokenSecret, setShowTokenSecret] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [copiadoContratanteModal, setCopiadoContratanteModal] = useState(false)
  const [copiadoContratadoModal, setCopiadoContratadoModal] = useState(false)

  // Signatários da escola configurados
  const escolaSignatarios = useMemo(() => zapConfig.signatariosEscola || [], [zapConfig.signatariosEscola])
  const escolaSignatarioAtual = useMemo(() => {
    if (!escolaSignatarios.length) return null
    return (
      escolaSignatarios.find(s => s.id === escolaSignatarioSelId) ||
      escolaSignatarios.find(s => s.isDefault) ||
      escolaSignatarios[0]
    )
  }, [escolaSignatarios, escolaSignatarioSelId])

  // Helper para obter nome oficial da turma
  const getNomeTurma = (aluno: AlunoBusca | null | undefined): string => {
    if (!aluno) return '—'
    if (aluno.turma_nome) return aluno.turma_nome
    if (aluno.turma) {
      const t = turmas?.find(x =>
        String(x.id) === String(aluno.turma) ||
        String(x.codigo) === String(aluno.turma) ||
        x.nome?.toLowerCase() === aluno.turma?.toLowerCase()
      )
      if (t?.nome) return t.nome
      return aluno.turma
    }
    if (aluno.serie) return aluno.serie
    return 'Educação Básica'
  }

  // Máscaras e formatações
  const formatarTelefone = (valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
  }

  const formatarCNPJ = (valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 14)
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
  }

  const formatarCPF = (valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }

  // ── Carregar Dados Iniciais ──
  useEffect(() => {
    carregarConfiguracoes()
    carregarContratos()
  }, [])

  // Carregar Configurações ZapSign
  const carregarConfiguracoes = async () => {
    try {
      const res = await fetch('/api/matriculas/config')
      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setZapConfig(data.config)
          setHasTokenConfigurado(data.hasToken)
          if (data.config.authModePadrao) {
            setAuthMode(data.config.authModePadrao)
          }
          if (data.config.signatariosEscola && data.config.signatariosEscola.length > 0) {
            const def = data.config.signatariosEscola.find((s: SignatarioEscola) => s.isDefault) || data.config.signatariosEscola[0]
            if (def) setEscolaSignatarioSelId(def.id)
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações do ZapSign:', e)
    }
  }

  // Carregar Lista de Contratos
  const carregarContratos = async () => {
    setIsLoadingContratos(true)
    try {
      // Carrega a base completa para que os KPIs e a filtragem em tempo real funcionem perfeitamente
      const res = await fetch('/api/matriculas/contratos')
      if (res.ok) {
        const data = await res.json()
        setContratos(data.contratos || [])
        if (data.metrics) setMetrics(data.metrics)
      }
    } catch (err: any) {
      showToast('Erro ao carregar lista de contratos.', 'error')
    } finally {
      setIsLoadingContratos(false)
    }
  }

  // Obter link de assinatura específico do Representante Legal da Empresa (Contratado)
  const getUrlAssinaturaEmpresa = (c: ContratoRecord): string | null => {
    if (c.metadata?.escolaSignUrl) return c.metadata.escolaSignUrl
    const signers: any[] = Array.isArray(c.metadata?.signers) ? c.metadata.signers : []
    const escolaSigner = signers.find((s: any) =>
      (s.name && (s.name.toLowerCase().includes('contratado') || s.name.toLowerCase().includes('escola'))) ||
      (s.qualification && s.qualification.toLowerCase().includes('contratado'))
    ) || (signers.length > 1 ? signers[1] : null)
    return escolaSigner?.sign_url || c.metadata?.escolaSignatario?.signUrl || null
  }

  // Obter progresso e quem falta assinar no ZapSign
  const getSignersProgress = (c: ContratoRecord) => {
    const signers: any[] = Array.isArray(c.metadata?.signers) ? c.metadata.signers : []
    const total = signers.length > 0 ? signers.length : (c.metadata?.assinarPelaEscola || c.metadata?.escolaSignatario ? 2 : 1)

    let assinados = 0
    const pendentesNomes: string[] = []

    if (signers.length > 0) {
      signers.forEach((s: any) => {
        const isSigned = s.status === 'signed' || Boolean(s.signed_at) || (Number(s.times_signed) > 0)
        if (isSigned) {
          assinados++
        } else {
          let cleanName = (s.name || '')
            .replace(/\s*\(.*?\)/g, '')
            .replace(/\s*-\s*Contratad[oa].*$/i, '')
            .replace(/\s*-\s*Contratante.*$/i, '')
            .trim()
          if (!cleanName) {
            cleanName = s.name || 'Signatário'
          }
          pendentesNomes.push(cleanName)
        }
      })
    } else {
      if (c.status === 'assinado') {
        assinados = total
      } else {
        assinados = 0
        pendentesNomes.push(c.responsavel_nome || 'Contratante')
        if (c.metadata?.assinarPelaEscola || c.metadata?.escolaSignatario) {
          pendentesNomes.push(c.metadata?.escolaSignatario?.nomeRepresentante || 'Escola')
        }
      }
    }

    const todosAssinaram = assinados >= total && total > 0

    return {
      total,
      assinados,
      todosAssinaram,
      pendentesNomes,
      progressoTexto: `${assinados}/${total} assinados`,
    }
  }

  // Métricas globais calculadas dinamicamente com base nas assinaturas reais de cada contrato
  const calculatedMetrics = useMemo(() => {
    const total = contratos.length
    let assinados = 0
    let recusados = 0
    let aguardando = 0

    contratos.forEach(c => {
      const isRecusado = c.status === 'recusado' || c.status === 'cancelado'
      if (isRecusado) {
        recusados++
        return
      }
      const progress = getSignersProgress(c)
      if (progress.todosAssinaram || c.status === 'assinado') {
        assinados++
      } else {
        aguardando++
      }
    })

    const taxaAssinatura = total > 0 ? Math.round((assinados / total) * 100) : 0

    return {
      total,
      aguardando,
      assinados,
      recusados,
      taxaAssinatura,
    }
  }, [contratos])

  // Lista de contratos filtrada em tempo real por status e termo de busca (0ms de latência)
  const contratosFiltrados = useMemo(() => {
    return contratos.filter(c => {
      const isRecusado = c.status === 'recusado' || c.status === 'cancelado'
      const progress = getSignersProgress(c)
      const isAssinado = !isRecusado && (progress.todosAssinaram || c.status === 'assinado')
      const isAguardando = !isRecusado && !isAssinado

      // 1. Filtro de Status
      if (filtroStatus === 'assinado' && !isAssinado) return false
      if (filtroStatus === 'aguardando' && !isAguardando) return false
      if (filtroStatus === 'recusado' && !isRecusado) return false

      // 2. Filtro de Ano Letivo (se houver)
      if (filtroAno && String(c.ano_letivo) !== String(filtroAno)) {
        return false
      }

      // 3. Filtro de Busca em Tempo Real
      if (filtroBusca && filtroBusca.trim() !== '') {
        const termo = filtroBusca.toLowerCase().trim()
        const termoNumerico = termo.replace(/\D/g, '')

        const alunoNome = (c.aluno_nome || '').toLowerCase()
        const alunoTurma = (c.aluno_turma || c.aluno_serie || '').toLowerCase()
        const respNome = (c.responsavel_nome || '').toLowerCase()
        const respCpf = (c.responsavel_cpf || '').toLowerCase()
        const respCpfNum = (c.responsavel_cpf || '').replace(/\D/g, '')
        const respTel = (c.responsavel_telefone || '').toLowerCase()
        const respTelNum = (c.responsavel_telefone || '').replace(/\D/g, '')
        const respEmail = (c.responsavel_email || '').toLowerCase()
        const tipoDoc = (c.tipo_documento || '').toLowerCase()

        // Representante Legal da Empresa / Escola
        const escRep = (c.metadata?.escolaSignatario?.nomeRepresentante || c.metadata?.escolaSignatario?.nome || '').toLowerCase()
        const escRazao = (c.metadata?.escolaSignatario?.razaoSocial || '').toLowerCase()
        const escCnpj = (c.metadata?.escolaSignatario?.cnpj || '').toLowerCase()

        // Nomes dos signatários na ZapSign
        const signersNames = Array.isArray(c.metadata?.signers)
          ? c.metadata.signers.map((s: any) => s.name || '').join(' ').toLowerCase()
          : ''

        const matches =
          alunoNome.includes(termo) ||
          alunoTurma.includes(termo) ||
          respNome.includes(termo) ||
          respCpf.includes(termo) ||
          (termoNumerico.length >= 3 && respCpfNum.includes(termoNumerico)) ||
          respTel.includes(termo) ||
          (termoNumerico.length >= 3 && respTelNum.includes(termoNumerico)) ||
          respEmail.includes(termo) ||
          tipoDoc.includes(termo) ||
          escRep.includes(termo) ||
          escRazao.includes(termo) ||
          escCnpj.includes(termo) ||
          signersNames.includes(termo)

        if (!matches) return false
      }

      return true
    })
  }, [contratos, filtroStatus, filtroAno, filtroBusca])

  // Exclusão definitiva do contrato no sistema e no ZapSign
  const handleConfirmarExclusaoContrato = async () => {
    if (!contratoParaExcluir) return
    setIsExcluindoContrato(true)
    try {
      const params = new URLSearchParams()
      if (contratoParaExcluir.id) params.append('id', contratoParaExcluir.id)
      if (contratoParaExcluir.zapsign_doc_token) params.append('docToken', contratoParaExcluir.zapsign_doc_token)

      const res = await fetch(`/api/matriculas/contratos?${params.toString()}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('Contrato excluído com sucesso do sistema e cancelado no ZapSign!', 'success')
        setContratoParaExcluir(null)
        carregarContratos()
      } else {
        throw new Error(data.error || 'Falha ao excluir contrato.')
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir contrato.', 'error')
    } finally {
      setIsExcluindoContrato(false)
    }
  }

  // Busca de Alunos com debounce
  useEffect(() => {
    if (!searchAluno || searchAluno.trim().length < 2) {
      setAlunosSugeridos([])
      setIsDropdownOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingAlunos(true)
      try {
        const res = await fetch(`/api/alunos?search=${encodeURIComponent(searchAluno.trim())}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          const list = data.alunos || data.data || []
          setAlunosSugeridos(list)
          setIsDropdownOpen(list.length > 0)
        }
      } catch (e) {
        console.warn('Erro na busca de alunos:', e)
      } finally {
        setIsSearchingAlunos(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchAluno])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Quando um Aluno é selecionado: buscar responsáveis vinculados
  const handleSelectAluno = async (aluno: AlunoBusca) => {
    setAlunoSel(aluno)
    setSearchAluno(aluno.nome)
    setIsDropdownOpen(false)
    setIsLoadingResponsaveis(true)
    setResponsaveisAluno([])
    setResponsavelSel(null)
    setRespCpf('')
    setTituloDocumento(`Contrato de Matrícula - ${aluno.nome}`)

    try {
      const res = await fetch(`/api/aluno-responsavel?aluno_id=${encodeURIComponent(aluno.id)}`)
      if (res.ok) {
        const data = await res.json()
        const resps: ResponsavelOption[] = data.responsaveis || []
        setResponsaveisAluno(resps)

        // Auto-seleciona o responsável financeiro se houver
        const fin = resps.find(r => r.isFinanceiro) || resps[0]
        if (fin) {
          selecionarResponsavel(fin)
        } else {
          setRespNome(aluno.responsavel_financeiro || aluno.responsavel || '')
          setRespCpf(formatarCPF((aluno as any).responsavel_cpf || (aluno as any).cpf_responsavel || ''))
          setRespTelefone(formatarTelefone(aluno.telefone || ''))
          setRespEmail('')
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar responsáveis do aluno:', e)
    } finally {
      setIsLoadingResponsaveis(false)
    }
  }

  const selecionarResponsavel = (r: ResponsavelOption) => {
    setResponsavelSel(r)
    setRespNome(r.nome || '')
    setRespCpf(formatarCPF(r.cpf || ''))
    setRespTelefone(formatarTelefone(r.telefone || r.celular || ''))
    setRespEmail(r.email || '')
    setRespParentesco(r.parentesco || (r.isFinanceiro ? 'Resp. Financeiro' : 'Responsável'))
  }

  // ── Tratamento de Múltiplos Arquivos Anexos (PDF) ──
  const processarArquivos = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    const pdfFiles: File[] = []
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showToast(`O arquivo "${file.name}" não é PDF. Anexe apenas arquivos PDF.`, 'error')
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(`O arquivo "${file.name}" excede o limite máximo de 10 MB.`, 'error')
        continue
      }
      pdfFiles.push(file)
    }

    if (pdfFiles.length === 0) return

    try {
      const novosArquivos: ArquivoAnexoItem[] = await Promise.all(
        pdfFiles.map(file => {
          return new Promise<ArquivoAnexoItem>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = reader.result as string
              const tamanhoFormatado = file.size > 1024 * 1024
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                : `${Math.round(file.size / 1024)} KB`
              resolve({
                id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                nome: file.name,
                tamanhoFormatado,
                tamanhoBytes: file.size,
                base64,
              })
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        })
      )

      setArquivosAnexados(prev => [...prev, ...novosArquivos])
      showToast(
        novosArquivos.length === 1
          ? `Arquivo "${novosArquivos[0].nome}" anexado com sucesso!`
          : `${novosArquivos.length} arquivos PDF anexados com sucesso!`,
        'success'
      )
    } catch (e) {
      showToast('Erro ao processar leitura dos arquivos anexados.', 'error')
    }
  }

  const removerArquivoItem = (id: string) => {
    setArquivosAnexados(prev => prev.filter(f => f.id !== id))
    showToast('Arquivo removido do pacote de assinatura.', 'info')
  }

  const visualizarArquivoItem = (item: ArquivoAnexoItem) => {
    if (!item?.base64) return
    try {
      const cleanBase64 = item.base64.replace(/^data:application\/pdf;base64,/, '').trim()
      const byteCharacters = atob(cleanBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
    } catch (err) {
      showToast('Não foi possível abrir a pré-visualização do PDF.', 'error')
    }
  }

  const totalTamanhoBytes = useMemo(() => {
    return arquivosAnexados.reduce((acc, f) => acc + f.tamanhoBytes, 0)
  }, [arquivosAnexados])

  const totalTamanhoFormatado = useMemo(() => {
    if (totalTamanhoBytes === 0) return '0 KB'
    return totalTamanhoBytes > 1024 * 1024
      ? `${(totalTamanhoBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.round(totalTamanhoBytes / 1024)} KB`
  }, [totalTamanhoBytes])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) processarArquivos(files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) processarArquivos(files)
  }

  // ── Enviar Documentos para ZapSign (com Bilateral e Multi-PDF) ──
  const handleEnviarZapSign = async () => {
    if (!respNome.trim()) {
      showToast('Por favor, informe ou selecione o responsável que irá assinar.', 'error')
      return
    }
    const cleanRespCpfDigits = respCpf.replace(/\D/g, '')

    if (authMode === 'tokenWhatsapp' && !respTelefone.trim()) {
      showToast('Para envio por WhatsApp, informe o celular com DDD do responsável.', 'error')
      return
    }
    if (authMode === 'tokenEmail' && !respEmail.trim()) {
      showToast('Para envio por E-mail, informe o e-mail do responsável.', 'error')
      return
    }
    if (arquivosAnexados.length === 0) {
      showToast('Por favor, anexe ao menos um arquivo PDF do contrato para assinatura.', 'error')
      return
    }
    let cleanEscolaCpfDigits = ''
    if (assinarPelaEscola) {
      if (!escolaSignatarioAtual) {
        showToast('Nenhum signatário da escola selecionado para a assinatura bilateral.', 'error')
        return
      }
      if (!escolaSignatarioAtual.nomeRepresentante?.trim()) {
        showToast('O nome do representante da escola é obrigatório.', 'error')
        return
      }
      cleanEscolaCpfDigits = (escolaSignatarioAtual.cpfRepresentante || '').replace(/\D/g, '')
    }

    setIsSendingZapSign(true)

    try {
      const payload = {
        aluno: alunoSel ? {
          id: alunoSel.id,
          nome: alunoSel.nome,
          turma: alunoSel.turma,
          turma_nome: getNomeTurma(alunoSel),
          serie: alunoSel.serie,
          matricula: alunoSel.matricula || alunoSel.codigo,
        } : undefined,
        responsavel: {
          id: responsavelSel?.id,
          nome: respNome.trim(),
          cpf: cleanRespCpfDigits,
          telefone: respTelefone.trim(),
          email: respEmail.trim(),
          parentesco: respParentesco,
        },
        arquivos: arquivosAnexados.map(a => ({ nome: a.nome, base64: a.base64 })),
        arquivoBase64: arquivosAnexados[0].base64,
        nomeArquivo: arquivosAnexados.length === 1
          ? arquivosAnexados[0].nome
          : `${arquivosAnexados[0].nome} (+${arquivosAnexados.length - 1} anexo${arquivosAnexados.length > 2 ? 's' : ''})`,
        nomeDocumento: tituloDocumento.trim() || (alunoSel ? `Contrato de Matrícula - ${alunoSel.nome}` : (arquivosAnexados[0]?.nome ? arquivosAnexados[0].nome.replace(/\.pdf$/i, '') : 'Contrato para Assinatura')),
        authMode,
        assinarPelaEscola: Boolean(assinarPelaEscola),
        escolaSignatario: assinarPelaEscola && escolaSignatarioAtual ? {
          id: escolaSignatarioAtual.id,
          cnpj: escolaSignatarioAtual.cnpj,
          razaoSocial: escolaSignatarioAtual.razaoSocial,
          nomeRepresentante: escolaSignatarioAtual.nomeRepresentante,
          cpfRepresentante: cleanEscolaCpfDigits,
          email: escolaSignatarioAtual.email,
          telefone: escolaSignatarioAtual.telefone,
          celular: escolaSignatarioAtual.telefone,
          cargo: escolaSignatarioAtual.cargo,
        } : undefined
      }

      const res = await fetch('/api/matriculas/zapsign/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'TOKEN_MISSING') {
          setActiveTab('config')
          showToast(data.message, 'info')
          return
        }
        throw new Error(data.error || 'Falha ao processar envio para o ZapSign.')
      }

      showToast('Documento enviado com sucesso para assinatura no ZapSign!', 'success')

      setEnvioSucessoModal({
        docToken: data.zapsign?.docToken,
        signUrl: data.zapsign?.signUrl,
        whatsappLink: data.zapsign?.whatsappLink,
        alunoNome: alunoSel ? alunoSel.nome : 'Avulso (Sem Estudante Vinculado)',
        respNome: respNome,
        respCpf: formatarCPF(cleanRespCpfDigits),
        nomeArquivo: arquivosAnexados.map(a => a.nome).join(', '),
        totalArquivos: arquivosAnexados.length,
        escolaSignatario: assinarPelaEscola && escolaSignatarioAtual ? {
          nome: escolaSignatarioAtual.nomeRepresentante,
          cargo: escolaSignatarioAtual.cargo,
          razaoSocial: escolaSignatarioAtual.razaoSocial,
          cnpj: escolaSignatarioAtual.cnpj,
          cpf: formatarCPF(cleanEscolaCpfDigits),
          signUrl: data.zapsign?.escolaSignUrl,
          whatsappLink: data.zapsign?.escolaWhatsappLink,
        } : undefined
      })

      carregarContratos()
    } catch (err: any) {
      showToast(err.message || 'Erro inesperado ao enviar contrato.', 'error')
    } finally {
      setIsSendingZapSign(false)
    }
  }

  // ── Gestão de Signatários da Escola (Configuração) ──
  const handleSalvarSignatarioEscola = async (signatarioData: Partial<SignatarioEscola>) => {
    const cleanCpf = (signatarioData.cpfRepresentante || '').replace(/\D/g, '')
    if (!signatarioData.cnpj || !signatarioData.razaoSocial || !signatarioData.nomeRepresentante || !signatarioData.email || !signatarioData.telefone) {
      showToast('Preencha os campos obrigatórios (CNPJ, Razão Social, Representante, E-mail, Celular).', 'error')
      return
    }
    if (!cleanCpf || cleanCpf.length !== 11) {
      showToast('O CPF do representante da escola é obrigatório para validação no ZapSign e deve conter 11 dígitos.', 'error')
      return
    }

    const existingList = zapConfig.signatariosEscola || []
    let updatedList: SignatarioEscola[] = []

    if (signatarioEditando) {
      updatedList = existingList.map(item => {
        if (item.id === signatarioEditando.id) {
          return {
            ...item,
            ...signatarioData,
            id: item.id,
            isDefault: signatarioData.isDefault ?? item.isDefault,
          } as SignatarioEscola
        }
        if (signatarioData.isDefault) {
          return { ...item, isDefault: false }
        }
        return item
      })
    } else {
      const novo: SignatarioEscola = {
        id: `escola_sig_${Date.now()}`,
        cnpj: signatarioData.cnpj || '',
        razaoSocial: signatarioData.razaoSocial || '',
        nomeRepresentante: signatarioData.nomeRepresentante || '',
        cpfRepresentante: signatarioData.cpfRepresentante || '',
        email: signatarioData.email || '',
        telefone: signatarioData.telefone || '',
        cargo: signatarioData.cargo || 'Representante Legal',
        isDefault: existingList.length === 0 ? true : Boolean(signatarioData.isDefault),
      }

      if (novo.isDefault) {
        updatedList = existingList.map(item => ({ ...item, isDefault: false }))
        updatedList.push(novo)
      } else {
        updatedList = [...existingList, novo]
      }
    }

    const newConfig = {
      ...zapConfig,
      signatariosEscola: updatedList
    }

    setZapConfig(newConfig)
    setModalSignatarioEscolaAberto(false)
    setSignatarioEditando(null)

    try {
      const res = await fetch('/api/matriculas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })
      if (res.ok) {
        showToast('Signatário da escola salvo com sucesso!', 'success')
        if (!escolaSignatarioSelId) {
          const def = updatedList.find(s => s.isDefault) || updatedList[0]
          if (def) setEscolaSignatarioSelId(def.id)
        }
      } else {
        throw new Error('Falha ao salvar no banco.')
      }
    } catch (err) {
      showToast('Erro ao persistir signatário da escola.', 'error')
    }
  }

  const handleDefinirSignatarioPadrao = async (id: string) => {
    const existingList = zapConfig.signatariosEscola || []
    const updatedList = existingList.map(item => ({
      ...item,
      isDefault: item.id === id,
    }))

    const newConfig = { ...zapConfig, signatariosEscola: updatedList }
    setZapConfig(newConfig)
    setEscolaSignatarioSelId(id)

    try {
      await fetch('/api/matriculas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })
      showToast('Signatário padrão da escola atualizado!', 'success')
    } catch (err) {
      showToast('Erro ao salvar no banco.', 'error')
    }
  }

  const handleExcluirSignatarioEscola = async (id: string) => {
    const existingList = zapConfig.signatariosEscola || []
    if (existingList.length <= 1) {
      showToast('Mantenha ao menos um signatário oficial para a instituição.', 'info')
      return
    }

    const updatedList = existingList.filter(item => item.id !== id)
    if (!updatedList.some(item => item.isDefault) && updatedList.length > 0) {
      updatedList[0].isDefault = true
    }

    const newConfig = { ...zapConfig, signatariosEscola: updatedList }
    setZapConfig(newConfig)
    if (escolaSignatarioSelId === id && updatedList.length > 0) {
      setEscolaSignatarioSelId(updatedList[0].id)
    }

    try {
      await fetch('/api/matriculas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })
      showToast('Signatário da escola excluído com sucesso.', 'info')
    } catch (err) {
      showToast('Erro ao atualizar no banco.', 'error')
    }
  }

  // ── Sincronizar Status com ZapSign ──
  const handleSincronizarStatus = async (contrato: ContratoRecord) => {
    if (!contrato.zapsign_doc_token) {
      showToast('Este contrato não possui identificador do ZapSign.', 'info')
      return
    }

    setSincronizandoId(contrato.id)
    try {
      const res = await fetch('/api/matriculas/zapsign/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docToken: contrato.zapsign_doc_token,
          contratoId: contrato.id,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        showToast(`Status atualizado: ${data.statusAtual.toUpperCase()}`, 'success')
        carregarContratos()
      } else {
        throw new Error(data.error || 'Erro ao sincronizar status.')
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar ao ZapSign.', 'error')
    } finally {
      setSincronizandoId(null)
    }
  }

  // ── Salvar Configurações ZapSign ──
  const handleSalvarConfig = async () => {
    setIsSavingConfig(true)
    try {
      const res = await fetch('/api/matriculas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zapConfig),
      })

      const data = await res.json()
      if (res.ok) {
        showToast('Configurações do ZapSign salvas com sucesso!', 'success')
        setHasTokenConfigurado(Boolean(zapConfig.apiToken.trim()))
      } else {
        throw new Error(data.error || 'Erro ao salvar configurações.')
      }
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setIsSavingConfig(false)
    }
  }

  // ── Testar Conexão ZapSign ──
  const handleTestarConexao = async () => {
    setIsTestingConnection(true)
    try {
      const res = await fetch('/api/matriculas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_connection',
          apiToken: zapConfig.apiToken,
          sandbox: zapConfig.sandbox,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        showToast(data.message, 'success')
      } else {
        showToast(data.message || 'Falha na conexão com o ZapSign.', 'error')
      }
    } catch (err: any) {
      showToast('Erro de comunicação com o servidor.', 'error')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const copiarParaTransferencia = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto)
    setCopiedLink(label)
    showToast(`${label} copiado! 📋`, 'info')
    setTimeout(() => setCopiedLink(null), 2500)
  }

  const handleCopiarContratanteModal = () => {
    if (!envioSucessoModal?.signUrl) return
    navigator.clipboard.writeText(envioSucessoModal.signUrl)
    setCopiadoContratanteModal(true)
    showToast('Link do Contratante copiado com sucesso! 📋', 'success')
    setTimeout(() => setCopiadoContratanteModal(false), 3000)
  }

  const handleCopiarContratadoModal = () => {
    if (!envioSucessoModal?.escolaSignatario?.signUrl) return
    navigator.clipboard.writeText(envioSucessoModal.escolaSignatario.signUrl)
    setCopiadoContratadoModal(true)
    showToast('Link do Contratado copiado com sucesso! 📋', 'success')
    setTimeout(() => setCopiadoContratadoModal(false), 3000)
  }

  // Estilo ultra moderno para inputs
  // Estilo ultra moderno e light para inputs
  const modernInputStyle = {
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    borderRadius: 14,
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: 600,
    padding: '12px 16px',
    outline: 'none',
    width: '100%',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  }

  return (
    <div style={{ fontFamily: 'Outfit, system-ui, -apple-system, sans-serif' }} className="space-y-6 pb-20">
      
      {/* Estilos Globais e Micro-interações da Página (Light & Ultra Moderno) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .mo-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .mo-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .mo-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 8px;
        }
        .mo-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .mo-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mo-kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 20px;
          box-shadow: 0 4px 18px -2px rgba(15, 23, 42, 0.05);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .mo-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.08);
        }

        .mo-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          white-space: nowrap;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          color: #64748b;
          background: transparent;
        }
        .mo-tab-btn:hover {
          color: #0f172a;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
        }
        .mo-tab-btn.active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 800;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
        }

        .mo-input {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 14px;
          color: #0f172a;
          font-size: 13.5px;
          font-weight: 600;
          padding: 12px 16px;
          outline: none;
          width: 100%;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .mo-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .mo-resp-card {
          padding: 14px 16px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
        }
        .mo-resp-card:hover {
          border-color: #93c5fd;
          background: #eff6ff;
          transform: translateY(-1px);
        }
        .mo-resp-card.selected {
          border-color: #2563eb;
          background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.12);
        }

        .mo-auth-card {
          padding: 16px;
          border-radius: 18px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
        }
        .mo-auth-card:hover {
          transform: translateY(-2px);
          background: #ffffff;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
        }
      `}} />
      
      {/* Toast flutuante moderno */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: 'fixed', top: 24, right: 24, zIndex: 9999,
              background: toastMsg.type === 'success' ? '#ffffff' : toastMsg.type === 'error' ? '#ffffff' : '#ffffff',
              color: '#0f172a',
              padding: '14px 22px',
              borderRadius: 16,
              border: `1.5px solid ${toastMsg.type === 'success' ? '#86efac' : toastMsg.type === 'error' ? '#fca5a5' : '#bfdbfe'}`,
              boxShadow: '0 12px 35px rgba(15, 23, 42, 0.12)',
              fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10
            }}
          >
            {toastMsg.type === 'success' && <CheckCircle2 size={18} color="#16a34a" />}
            {toastMsg.type === 'error' && <AlertCircle size={18} color="#dc2626" />}
            {toastMsg.type === 'info' && <Sparkles size={18} color="#2563eb" />}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 1. TOP HEADER BANNER (LIGHT & ULTRA MODERNO) ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: 22,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 25px -4px rgba(15, 23, 42, 0.05)',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: '0.05em'
            }}>
              <Zap size={13} color="#2563eb" />
              INTEGRAÇÃO ZAPSIGN
            </span>

            <span style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: '0.04em'
            }}>
              <CheckCircle2 size={13} color="#059669" />
              WHATSAPP & E-MAIL
            </span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.025em' }}>
            Matrículas Online – Envio de Contratos para Assinatura
          </h1>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
            Busque o aluno, selecione o responsável para puxar automaticamente o WhatsApp e E-mail, anexe o arquivo PDF e dispare a assinatura digital com 1 clique.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!hasTokenConfigurado && (
            <button
              onClick={() => setActiveTab('config')}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '11px 18px',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              <Key size={15} />
              <span>Configurar Token ZapSign</span>
            </button>
          )}

          <button
            onClick={() => {
              carregarContratos()
              showToast('Painel de assinaturas atualizado!', 'info')
            }}
            style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              color: '#334155',
              borderRadius: 14,
              padding: '11px 18px',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#e2e8f0'
            }}
          >
            <RefreshCw size={14} className={isLoadingContratos ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KPI METRIC CARDS (LIGHT & ULTRA MODERNO) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '28px 0' }}>
        {/* Total */}
        <div className="mo-kpi-card" style={{ borderLeft: '4px solid #3b82f6', padding: '13px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total Enviados
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSignature size={14} color="#2563eb" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 6, letterSpacing: '-0.02em' }}>
            {calculatedMetrics.total}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
            Documentos emitidos
          </div>
        </div>

        {/* Aguardando */}
        <div className="mo-kpi-card" style={{ borderLeft: '4px solid #f59e0b', padding: '13px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Aguardando
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={14} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#b45309', marginTop: 6, letterSpacing: '-0.02em' }}>
            {calculatedMetrics.aguardando}
          </div>
          <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            Pendentes de assinatura
          </div>
        </div>

        {/* Assinados */}
        <div className="mo-kpi-card" style={{ borderLeft: '4px solid #10b981', padding: '13px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Assinados
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={14} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#047857', marginTop: 6, letterSpacing: '-0.02em' }}>
            {calculatedMetrics.assinados}
          </div>
          <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            Certificados ZapSign
          </div>
        </div>

        {/* Recusados */}
        <div className="mo-kpi-card" style={{ borderLeft: '4px solid #ef4444', padding: '13px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recusados
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={14} color="#dc2626" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#b91c1c', marginTop: 6, letterSpacing: '-0.02em' }}>
            {calculatedMetrics.recusados}
          </div>
          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
            Cancelados / Expirados
          </div>
        </div>

        {/* Conversão */}
        <div className="mo-kpi-card" style={{ borderLeft: '4px solid #8b5cf6', padding: '13px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Conversão
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="#7c3aed" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#6d28d9', marginTop: 6, letterSpacing: '-0.02em' }}>
            {calculatedMetrics.taxaAssinatura}%
          </div>
          <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} />
            Taxa de conclusão
          </div>
        </div>
      </div>

      {/* ─── 3. SEGMENTED TABS PILLS (LIGHT & ULTRA MODERNO) ─── */}
      <div style={{
        background: '#f1f5f9',
        padding: '6px',
        borderRadius: 18,
        border: '1px solid #e2e8f0',
        display: 'flex',
        gap: 6,
        overflowX: 'auto'
      }}>
        {[
          { id: 'emitir', label: 'Nova Matrícula / Anexar e Enviar', icon: <FileUp size={16} /> },
          { id: 'painel', label: `Painel de Assinaturas`, count: calculatedMetrics.total, icon: <Clock size={16} /> },
          { id: 'modelos', label: 'Informações & Validade Jurídica', icon: <FileText size={16} /> },
          { id: 'config', label: 'Configurações ZapSign', icon: <Settings size={16} /> },
        ].map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any)
                if (tab.id === 'painel') carregarContratos()
              }}
              className={`mo-tab-btn ${isActive ? 'active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof (tab as any).count === 'number' && (
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 900,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                  color: isActive ? '#ffffff' : '#475569',
                  marginLeft: 2
                }}>
                  {(tab as any).count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          ABA 1: EMITIR (FLUXO SIMPLIFICADO: ALUNO -> RESPONSÁVEL -> ANEXAR -> ENVIAR)
      ──────────────────────────────────────────────────────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────────
          ABA 1: EMITIR (FLUXO SIMPLIFICADO: ALUNO -> RESPONSÁVEL -> ANEXAR -> ENVIAR - LIGHT & ULTRA MODERNO)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'emitir' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>
          
          {/* Coluna Principal: Passos 1, 2, 3 e 4 (8 colunas) */}
          <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* PASSO 1: Localizar Estudante */}
            <div className="mo-card" style={{
              padding: 0,
              overflow: 'visible',
              position: 'relative',
              zIndex: isDropdownOpen ? 100 : 20,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 20
            }}>
              {/* Header com Gradiente Pastel e Badge Vibrante */}
              <div style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderBottom: '1.5px solid #bfdbfe',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                borderRadius: '19px 19px 0 0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 13.5, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}>
                    1
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 15.5, fontWeight: 900, color: '#1e3a8a', margin: 0, letterSpacing: '-0.01em' }}>
                        Localizar Estudante no Sistema
                      </h2>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        background: '#dbeafe',
                        color: '#1e40af',
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid #bfdbfe',
                        letterSpacing: '0.04em'
                      }}>
                        OPCIONAL
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#2563eb', margin: '2px 0 0', fontWeight: 600 }}>
                      Digite o nome ou matrícula do aluno para auto-preenchimento ou preencha diretamente o responsável no Passo 2.
                    </p>
                  </div>
                </div>

                {alunoSel && (
                  <button
                    onClick={() => {
                      setAlunoSel(null)
                      setSearchAluno('')
                      setResponsaveisAluno([])
                      setResponsavelSel(null)
                      setRespNome('')
                      setRespCpf('')
                      setRespTelefone('')
                      setRespEmail('')
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #fecaca',
                      color: '#dc2626',
                      borderRadius: 10,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 1px 3px rgba(220, 38, 38, 0.08)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#fee2e2'
                      e.currentTarget.style.borderColor = '#f87171'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#ffffff'
                      e.currentTarget.style.borderColor = '#fecaca'
                    }}
                  >
                    <X size={13} />
                    <span>Trocar Aluno</span>
                  </button>
                )}
              </div>

              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!alunoSel ? (
                  <div ref={searchContainerRef} style={{ position: 'relative', zIndex: 110 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={18} style={{ position: 'absolute', left: 16, color: '#3b82f6', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Comece a digitar o nome do aluno para auto-preencher (opcional)..."
                        value={searchAluno}
                        onChange={e => setSearchAluno(e.target.value)}
                        onFocus={() => {
                          if (alunosSugeridos.length > 0) setIsDropdownOpen(true)
                        }}
                        className="mo-input"
                        style={{
                          paddingLeft: 46,
                          borderColor: isDropdownOpen ? '#3b82f6' : '#cbd5e1',
                        }}
                      />
                      {isSearchingAlunos && (
                        <RefreshCw size={16} className="animate-spin" style={{ position: 'absolute', right: 16, color: '#3b82f6' }} />
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>💡 <strong>Não obrigatório:</strong> se desejar, basta preencher diretamente o nome, CPF e contato do responsável no Passo 2.</span>
                    </div>

                    {/* Dropdown de Sugestões de Alunos */}
                    {isDropdownOpen && alunosSugeridos.length > 0 && (
                      <div className="mo-scroll" style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
                        background: '#ffffff',
                        border: '1.5px solid #93c5fd',
                        borderRadius: 16,
                        boxShadow: '0 25px 60px -10px rgba(15, 23, 42, 0.3), 0 12px 24px -4px rgba(37, 99, 235, 0.15)',
                        zIndex: 99999,
                        maxHeight: 340,
                        overflowY: 'auto',
                        padding: 8
                      }}>
                        {alunosSugeridos.map(aluno => (
                          <div
                            key={aluno.id}
                            onClick={() => handleSelectAluno(aluno)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease',
                              marginBottom: 2
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                                color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, fontSize: 15, flexShrink: 0
                              }}>
                                {aluno.nome.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{aluno.nome}</div>
                                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span>Matrícula: <strong style={{ color: '#334155' }}>{aluno.matricula || aluno.codigo || '—'}</strong></span>
                                  <span>•</span>
                                  <span>Turma: <strong style={{ color: '#2563eb' }}>{getNomeTurma(aluno)}</strong></span>
                                </div>
                              </div>
                            </div>
                            <button style={{
                              background: '#eff6ff', border: '1px solid #bfdbfe',
                              color: '#1d4ed8', borderRadius: 10, padding: '6px 14px', fontSize: 11.5, fontWeight: 800,
                              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer'
                            }}>
                              <span>Selecionar</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
                    borderRadius: 16,
                    border: '1.5px solid #bfdbfe',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.06)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, fontSize: 20, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                        flexShrink: 0
                      }}>
                        {alunoSel.nome.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>
                          {alunoSel.nome}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 11.5, padding: '2px 8px', borderRadius: 6,
                            background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe',
                            fontWeight: 700
                          }}>
                            Matrícula: {alunoSel.matricula || alunoSel.codigo || 'Pendente'}
                          </span>
                          <span style={{
                            fontSize: 11.5, padding: '2px 8px', borderRadius: 6,
                            background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe',
                            fontWeight: 800
                          }}>
                            Turma: {getNomeTurma(alunoSel)}
                          </span>
                          <span style={{
                            fontSize: 11.5, padding: '2px 8px', borderRadius: 6,
                            background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                            fontWeight: 700
                          }}>
                            Turno: {alunoSel.turno || 'Matutino'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#059669',
                      borderRadius: 12,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <CheckCircle2 size={15} color="#059669" />
                      <span>Estudante Selecionado</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PASSO 2: Selecionar o Responsável e Assinatura pela Escola */}
            <div className="mo-card" style={{
              padding: 0,
              overflow: 'visible',
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 20
            }}>
              {/* Header com Gradiente Pastel e Badge Vibrante */}
              <div style={{
                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                borderBottom: '1.5px solid #ddd6fe',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '19px 19px 0 0'
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 13.5, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}>
                  2
                </div>
                <div>
                  <h2 style={{ fontSize: 15.5, fontWeight: 900, color: '#3730a3', margin: 0, letterSpacing: '-0.01em' }}>
                    Signatários do Contrato de Matrícula
                  </h2>
                  <p style={{ fontSize: 12, color: '#4f46e5', margin: 0, fontWeight: 600 }}>
                    Selecione o responsável pelo estudante e configure a assinatura bilateral pela instituição.
                  </p>
                </div>
              </div>

              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* 1. Responsável pelo Aluno */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    1. Responsável Legal (Contratante)
                  </label>

                  {/* Cards dos Responsáveis Cadastrados */}
                  {alunoSel && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      {responsaveisAluno.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                          {responsaveisAluno.map(resp => {
                            const isSelected = responsavelSel?.id === resp.id || respNome.toLowerCase() === resp.nome.toLowerCase()
                            return (
                              <div
                                key={resp.id}
                                onClick={() => selecionarResponsavel(resp)}
                                className={`mo-resp-card ${isSelected ? 'selected' : ''}`}
                              >
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {resp.nome}
                                    {resp.isFinanceiro && (
                                      <span style={{
                                        fontSize: 9.5, fontWeight: 900, background: '#fef3c7',
                                        color: '#b45309', padding: '2px 7px', borderRadius: 6,
                                        border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: 3
                                      }}>
                                        <DollarSign size={10} strokeWidth={2.8} />
                                        Financeiro
                                      </span>
                                    )}
                                    {resp.isPedagogico && (
                                      <span style={{
                                        fontSize: 9.5, fontWeight: 900, background: '#eff6ff',
                                        color: '#1d4ed8', padding: '2px 7px', borderRadius: 6,
                                        border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: 3
                                      }}>
                                        <BookOpen size={10} strokeWidth={2.6} />
                                        Pedagógico
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                                    {resp.parentesco || 'Responsável'}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                                    {resp.telefone && (
                                      <span style={{ fontSize: 11, color: '#047857', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                                        <Smartphone size={12} />
                                        {resp.telefone}
                                      </span>
                                    )}
                                    {resp.email && (
                                      <span style={{ fontSize: 11, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                                        <Mail size={12} />
                                        {resp.email}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                                  background: isSelected ? '#2563eb' : 'transparent',
                                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none',
                                  flexShrink: 0
                                }}>
                                  {isSelected && <Check size={14} strokeWidth={3} />}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{
                          padding: '14px 18px', background: '#f8fafc',
                          borderRadius: 14, border: '1px dashed #cbd5e1',
                          fontSize: 12.5, color: '#64748b'
                        }}>
                          Nenhum responsável vinculado diretamente a este estudante. Preencha o nome, telefone e e-mail abaixo para envio.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inputs Nome, Telefone e Email do Responsável (CPF é digitado diretamente na tela de assinatura do ZapSign) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        Nome do Responsável <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <User size={16} style={{ position: 'absolute', left: 16, color: '#64748b', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          value={respNome}
                          onChange={e => setRespNome(e.target.value)}
                          placeholder="Nome completo do responsável"
                          className="mo-input"
                          style={{ paddingLeft: 44 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        Celular / WhatsApp (c/ DDD) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Smartphone size={16} style={{ position: 'absolute', left: 16, color: '#059669', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          value={respTelefone}
                          onChange={e => setRespTelefone(formatarTelefone(e.target.value))}
                          placeholder="(67) 99999-9999"
                          className="mo-input"
                          style={{ paddingLeft: 44 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        E-mail de Notificação
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Mail size={16} style={{ position: 'absolute', left: 16, color: '#2563eb', pointerEvents: 'none' }} />
                        <input
                          type="email"
                          value={respEmail}
                          onChange={e => setRespEmail(e.target.value)}
                          placeholder="responsavel@email.com"
                          className="mo-input"
                          style={{ paddingLeft: 44 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Informação sobre obrigatoriedade de CPF no ZapSign */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                    fontSize: 11.5,
                    color: '#475569',
                    background: '#f8fafc',
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0'
                  }}>
                    <ShieldCheck size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span>
                      A digitação do <strong>CPF</strong> será exigida de forma obrigatória diretamente pelo <strong>ZapSign</strong> na tela de assinatura do documento.
                    </span>
                  </div>
                </div>

                {/* 2. Co-assinatura da Escola (Assinatura Bilateral) */}
                <div style={{
                  background: assinarPelaEscola ? 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' : '#f8fafc',
                  border: assinarPelaEscola ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'all 0.25s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: assinarPelaEscola ? '#2563eb' : '#94a3b8',
                        color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: assinarPelaEscola ? '0 3px 10px rgba(37, 99, 235, 0.25)' : 'none'
                      }}>
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>2. Co-assinatura pela Escola (Contrato Bilateral)</span>
                          {assinarPelaEscola && (
                            <span style={{
                              fontSize: 10, fontWeight: 900, background: '#ecfdf5', color: '#047857',
                              border: '1px solid #a7f3d0', padding: '2px 7px', borderRadius: 6
                            }}>
                              ATIVADO
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                          A instituição assina o contrato eletronicamente em conjunto com o responsável.
                        </div>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => setAssinarPelaEscola(!assinarPelaEscola)}
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        border: 'none',
                        cursor: 'pointer',
                        background: assinarPelaEscola ? '#2563eb' : '#cbd5e1',
                        position: 'relative',
                        transition: 'background 0.2s',
                        padding: 3,
                        flexShrink: 0
                      }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#ffffff',
                        transform: assinarPelaEscola ? 'translateX(22px)' : 'translateX(0px)',
                        transition: 'transform 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>

                  {assinarPelaEscola && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                      {escolaSignatarios.length > 0 ? (
                        <>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                              Selecione qual CNPJ / Representante assinará pela Escola:
                            </label>
                            <select
                              value={escolaSignatarioSelId}
                              onChange={e => setEscolaSignatarioSelId(e.target.value)}
                              className="mo-input"
                              style={{ padding: '10px 14px', height: 42, cursor: 'pointer', background: '#ffffff' }}
                            >
                              {escolaSignatarios.map(sig => (
                                <option key={sig.id} value={sig.id}>
                                  {sig.cnpj} – {sig.razaoSocial} ({sig.nomeRepresentante}{sig.cargo ? ` - ${sig.cargo}` : ''}){sig.isDefault ? ' [Padrão]' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {escolaSignatarioAtual && (
                            <div style={{
                              background: '#ffffff',
                              border: '1px solid #bfdbfe',
                              borderRadius: 14,
                              padding: '12px 16px',
                              display: 'flex',
                              flexWrap: 'wrap',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12
                            }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                                  {escolaSignatarioAtual.razaoSocial}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>CNPJ: <strong>{escolaSignatarioAtual.cnpj}</strong></span>
                                  <span>•</span>
                                  <span>Representante: <strong>{escolaSignatarioAtual.nomeRepresentante}</strong> ({escolaSignatarioAtual.cargo || 'Direção'})</span>
                                  <span>•</span>
                                  <span>
                                    CPF: {escolaSignatarioAtual.cpfRepresentante ? (
                                      <strong style={{ color: '#0f172a' }}>{formatarCPF(escolaSignatarioAtual.cpfRepresentante)}</strong>
                                    ) : (
                                      <strong style={{ color: '#dc2626' }}>Pendente de preenchimento *</strong>
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: '#047857', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                                  <Smartphone size={12} />
                                  {escolaSignatarioAtual.telefone}
                                </span>
                                <span style={{ fontSize: 11, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                  <Mail size={12} />
                                  {escolaSignatarioAtual.email}
                                </span>
                              </div>
                            </div>
                          )}

                          {escolaSignatarioAtual && !escolaSignatarioAtual.cpfRepresentante && (
                            <div style={{
                              background: '#fef2f2',
                              border: '1.5px solid #fecaca',
                              borderRadius: 12,
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10
                            }}>
                              <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>
                                ⚠️ O CPF do representante da escola é obrigatório para envio no ZapSign e ainda não foi preenchido.
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSignatarioEditando(escolaSignatarioAtual)
                                  setFormSignatario({
                                    cnpj: escolaSignatarioAtual.cnpj,
                                    razaoSocial: escolaSignatarioAtual.razaoSocial,
                                    nomeRepresentante: escolaSignatarioAtual.nomeRepresentante,
                                    cpfRepresentante: '',
                                    email: escolaSignatarioAtual.email,
                                    telefone: escolaSignatarioAtual.telefone,
                                    cargo: escolaSignatarioAtual.cargo || '',
                                    isDefault: Boolean(escolaSignatarioAtual.isDefault)
                                  })
                                  setModalSignatarioEscolaAberto(true)
                                }}
                                style={{
                                  background: '#dc2626',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '5px 12px',
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Preencher CPF
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{
                          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
                          padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10
                        }}>
                          <div style={{ fontSize: 12, color: '#92400e' }}>
                            Nenhum signatário da escola configurado. Cadastre o CNPJ padrão na aba de Configurações.
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('config')}
                            style={{
                              background: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: 10,
                              padding: '6px 12px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}
                          >
                            Configurar Agora
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PASSO 3: Anexar Arquivos para Assinatura (Múltiplos PDFs) */}
            <div className="mo-card" style={{
              padding: 0,
              overflow: 'visible',
              position: 'relative',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 20
            }}>
              {/* Header com Gradiente Pastel e Badge Vibrante */}
              <div style={{
                background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
                borderBottom: '1.5px solid #fbcfe8',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '19px 19px 0 0'
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 13.5, boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
                }}>
                  3
                </div>
                <div>
                  <h2 style={{ fontSize: 15.5, fontWeight: 900, color: '#831843', margin: 0, letterSpacing: '-0.01em' }}>
                    Arquivos para Assinatura (Múltiplos PDFs)
                  </h2>
                  <p style={{ fontSize: 12, color: '#be185d', margin: 0, fontWeight: 600 }}>
                    Anexe um ou mais documentos em formato PDF para consolidação em documento único certificado.
                  </p>
                </div>
              </div>

              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Título do Documento no ZapSign */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Título do Documento no ZapSign
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <FileText size={16} style={{ position: 'absolute', left: 16, color: '#db2777', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      value={tituloDocumento}
                      onChange={e => setTituloDocumento(e.target.value)}
                      placeholder="Ex: Contrato de Prestação de Serviços Educacionais - Nome do Aluno"
                      className="mo-input"
                      style={{ paddingLeft: 44 }}
                    />
                  </div>
                </div>

                {/* Input Invisível para Upload (Suporta múltiplos) */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".pdf,application/pdf"
                  multiple
                  style={{ display: 'none' }}
                />

                {/* Dropzone ou Lista de Arquivos Anexados */}
                {arquivosAnexados.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleDrop}
                    style={{
                      border: isDraggingFile ? '2px dashed #ec4899' : '2px dashed #cbd5e1',
                      background: isDraggingFile ? '#fdf2f8' : '#f8fafc',
                      borderRadius: 18,
                      padding: '36px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#db2777'
                      e.currentTarget.style.background = '#fdf2f8'
                    }}
                    onMouseLeave={e => {
                      if (!isDraggingFile) {
                        e.currentTarget.style.borderColor = '#cbd5e1'
                        e.currentTarget.style.background = '#f8fafc'
                      }
                    }}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: 16,
                      background: '#fdf2f8',
                      border: '1px solid #fbcfe8',
                      color: '#db2777',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 3px 12px rgba(219, 39, 119, 0.15)'
                    }}>
                      <FileUp size={26} />
                    </div>

                    <div>
                      <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a', display: 'block' }}>
                        Clique para selecionar ou arraste seus arquivos PDF aqui
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' }}>
                        Você pode selecionar múltiplos arquivos (Contrato, Termo de Imagem, Regimento). Máx. 10 MB por arquivo.
                      </span>
                    </div>

                    <button
                      type="button"
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        color: '#334155',
                        borderRadius: 12,
                        padding: '9px 22px',
                        fontSize: 12,
                        fontWeight: 800,
                        marginTop: 2,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
                      }}
                    >
                      Selecionar Arquivos PDF
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Barra de Status do Pacote */}
                    <div style={{
                      background: 'linear-gradient(135deg, #fdf2f8 0%, #f8fafc 100%)',
                      border: '1.5px solid #fbcfe8',
                      borderRadius: 16,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 12,
                          background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 3px 10px rgba(236, 72, 153, 0.25)'
                        }}>
                          <Layers size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a' }}>
                            Pacote Consolidado: {arquivosAnexados.length} {arquivosAnexados.length === 1 ? 'documento' : 'documentos'}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                            Tamanho total: <strong style={{ color: '#db2777' }}>{totalTamanhoFormatado}</strong> • Serão mesclados em um documento único ZapSign
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: '#ffffff',
                          border: '1.5px solid #fbcfe8',
                          color: '#db2777',
                          borderRadius: 12,
                          padding: '8px 16px',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 1px 3px rgba(219, 39, 119, 0.08)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#fdf2f8'
                          e.currentTarget.style.borderColor = '#db2777'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#ffffff'
                          e.currentTarget.style.borderColor = '#fbcfe8'
                        }}
                      >
                        <Plus size={14} />
                        <span>Adicionar Mais Arquivos</span>
                      </button>
                    </div>

                    {/* Lista dos Arquivos Anexados */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {arquivosAnexados.map((item, index) => (
                        <div
                          key={item.id}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 14,
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12,
                            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, flex: 1 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 8,
                              background: '#fdf2f8', border: '1px solid #fbcfe8',
                              color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 900, flexShrink: 0
                            }}>
                              {index + 1}
                            </div>
                            <FileText size={18} color="#db2777" style={{ flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {item.nome}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                {item.tamanhoFormatado}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => visualizarArquivoItem(item)}
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                borderRadius: 10,
                                padding: '6px 12px',
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                transition: 'all 0.2s'
                              }}
                            >
                              <Eye size={13} />
                              <span>Visualizar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => removerArquivoItem(item.id)}
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                borderRadius: 10,
                                padding: '6px 10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              title="Remover este arquivo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PASSO 4: Como o ZapSign Deve Enviar e Validar */}
            <div className="mo-card" style={{
              padding: 0,
              overflow: 'visible',
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 20
            }}>
              {/* Header com Gradiente Pastel e Badge Vibrante */}
              <div style={{
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                borderBottom: '1.5px solid #a7f3d0',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '19px 19px 0 0'
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 13.5, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}>
                  4
                </div>
                <div>
                  <h2 style={{ fontSize: 15.5, fontWeight: 900, color: '#065f46', margin: 0, letterSpacing: '-0.01em' }}>
                    Como o ZapSign Deve Enviar e Validar
                  </h2>
                  <p style={{ fontSize: 12, color: '#047857', margin: 0, fontWeight: 600 }}>
                    Selecione por onde os signatários receberão a notificação oficial para assinatura.
                  </p>
                </div>
              </div>

              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  {/* Opção WhatsApp */}
                  <div
                    onClick={() => setAuthMode('tokenWhatsapp')}
                    className="mo-auth-card"
                    style={{
                      borderColor: authMode === 'tokenWhatsapp' ? '#10b981' : '#e2e8f0',
                      background: authMode === 'tokenWhatsapp'
                        ? '#ecfdf5'
                        : '#f8fafc',
                      boxShadow: authMode === 'tokenWhatsapp' ? '0 4px 16px rgba(16, 185, 129, 0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 900, color: '#047857', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <MessageSquare size={16} />
                        WhatsApp Oficial
                      </span>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: authMode === 'tokenWhatsapp' ? '#059669' : '#cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                      }}>
                        {authMode === 'tokenWhatsapp' && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: '4px 0 0', lineHeight: 1.45 }}>
                      O ZapSign dispara a mensagem oficial no WhatsApp com o link direto e código de validação.
                    </p>
                  </div>

                  {/* Opção E-mail */}
                  <div
                    onClick={() => setAuthMode('tokenEmail')}
                    className="mo-auth-card"
                    style={{
                      borderColor: authMode === 'tokenEmail' ? '#2563eb' : '#e2e8f0',
                      background: authMode === 'tokenEmail'
                        ? '#eff6ff'
                        : '#f8fafc',
                      boxShadow: authMode === 'tokenEmail' ? '0 4px 16px rgba(37, 99, 235, 0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 900, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Mail size={16} />
                        E-mail Certificado
                      </span>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: authMode === 'tokenEmail' ? '#2563eb' : '#cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                      }}>
                        {authMode === 'tokenEmail' && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: '4px 0 0', lineHeight: 1.45 }}>
                      O ZapSign envia o convite formal de assinatura diretamente para o e-mail cadastrado.
                    </p>
                  </div>
                </div>

                {/* Botão de Disparo */}
                <div style={{ paddingTop: 6 }}>
                  {(() => {
                    const isFormIncomplete = isSendingZapSign ||
                      arquivosAnexados.length === 0 ||
                      !respNome.trim() ||
                      (authMode === 'tokenWhatsapp' && !respTelefone.trim()) ||
                      (authMode === 'tokenEmail' && !respEmail.trim()) ||
                      (assinarPelaEscola && (!escolaSignatarioAtual || !escolaSignatarioAtual.nomeRepresentante?.trim()))

                    return (
                      <button
                        onClick={handleEnviarZapSign}
                        disabled={isFormIncomplete}
                        style={{
                          width: '100%',
                          height: 52,
                          borderRadius: 16,
                          fontSize: 14,
                          fontWeight: 900,
                          letterSpacing: '0.04em',
                          cursor: isFormIncomplete ? 'not-allowed' : 'pointer',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          color: '#ffffff',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          background: isFormIncomplete
                            ? '#cbd5e1'
                            : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                          boxShadow: isFormIncomplete
                            ? 'none'
                            : '0 8px 25px rgba(37, 99, 235, 0.35)',
                          opacity: isFormIncomplete ? 0.7 : 1
                        }}
                        onMouseEnter={e => {
                          if (!isFormIncomplete) {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 12px 30px rgba(37, 99, 235, 0.45)'
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none'
                          if (!isFormIncomplete) {
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.35)'
                          }
                        }}
                      >
                        {isSendingZapSign ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" />
                            <span>Consolidando e Enviando para o ZapSign...</span>
                          </>
                        ) : (
                          <>
                            <Send size={17} />
                            <span>
                              {arquivosAnexados.length > 1
                                ? `DISPARAR CONTRATO PARA ASSINATURA (${arquivosAnexados.length} ARQUIVOS CONSOLIDADOS)`
                                : 'DISPARAR CONTRATO PARA ASSINATURA'}
                            </span>
                          </>
                        )}
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Lateral: Resumo da Operação (4 colunas) com Gradiente Moderno */}
          <div style={{ gridColumn: 'span 4' }}>
            <div className="mo-card" style={{
              background: 'linear-gradient(160deg, #ffffff 0%, #f8fafc 40%, #eff6ff 100%)',
              border: '1.5px solid #dbeafe',
              borderRadius: 20,
              boxShadow: '0 10px 30px -4px rgba(37, 99, 235, 0.08), 0 2px 6px rgba(15, 23, 42, 0.03)',
              padding: '24px',
              position: 'sticky',
              top: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Resumo do Envio
                  </h3>
                  <span style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 600 }}>Contrato Digital Certificado</span>
                </div>
              </div>

              {/* Estudante */}
              <div style={{
                background: '#ffffff', borderRadius: 14,
                border: '1px solid #e2e8f0', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Estudante
                </span>
                {alunoSel ? (
                  <>
                    <span style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a' }}>
                      {alunoSel.nome}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 700 }}>
                      Turma: {getNomeTurma(alunoSel)} • Matrícula: {alunoSel.matricula || alunoSel.codigo || '—'}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b', fontStyle: 'italic' }}>
                    Não vinculado (Envio Avulso / Direto)
                  </span>
                )}
              </div>

              {/* Responsável Signatário */}
              <div style={{
                background: '#ffffff', borderRadius: 14,
                border: '1px solid #e2e8f0', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Signatário Responsável (Contratante)
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a' }}>
                  {respNome || 'Pendente de seleção'}
                </span>
                <span style={{ fontSize: 11.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                  CPF: {respCpf ? <strong style={{ color: '#0f172a' }}>{respCpf}</strong> : <span style={{ color: '#2563eb', fontWeight: 600 }}>Exigido no ZapSign</span>}
                </span>
                {respTelefone && (
                  <span style={{ fontSize: 11.5, color: '#059669', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, marginTop: 2 }}>
                    <Smartphone size={12} />
                    WhatsApp: {respTelefone}
                  </span>
                )}
                {respEmail && (
                  <span style={{ fontSize: 11.5, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                    <Mail size={12} />
                    E-mail: {respEmail}
                  </span>
                )}
              </div>

              {/* Assinatura pela Escola */}
              <div style={{
                background: '#ffffff', borderRadius: 14,
                border: '1px solid #e2e8f0', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Co-assinatura da Escola (Contratado)
                </span>
                {assinarPelaEscola && escolaSignatarioAtual ? (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                      {escolaSignatarioAtual.razaoSocial}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#4338ca', fontWeight: 700 }}>
                      CNPJ: {escolaSignatarioAtual.cnpj}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>
                      Repr: {escolaSignatarioAtual.nomeRepresentante} ({escolaSignatarioAtual.cargo || 'Direção'})
                    </span>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>
                      CPF Repr: {escolaSignatarioAtual.cpfRepresentante ? (
                        <strong style={{ color: '#0f172a' }}>{formatarCPF(escolaSignatarioAtual.cpfRepresentante)}</strong>
                      ) : (
                        <span style={{ color: '#6d28d9', fontWeight: 600 }}>Exigido no ZapSign</span>
                      )}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                    Apenas assinatura do responsável (unilateral).
                  </span>
                )}
              </div>

              {/* Arquivos do Pacote */}
              <div style={{
                background: '#ffffff', borderRadius: 14,
                border: '1px solid #e2e8f0', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 6,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Documentos ({arquivosAnexados.length})
                  </span>
                  {arquivosAnexados.length > 0 && (
                    <span style={{ fontSize: 10.5, color: '#db2777', fontWeight: 800 }}>
                      {totalTamanhoFormatado}
                    </span>
                  )}
                </div>

                {arquivosAnexados.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {arquivosAnexados.slice(0, 3).map((item, i) => (
                      <div key={item.id} style={{
                        background: '#fdf2f8',
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #fbcfe8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <FileText size={14} color="#db2777" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.nome}
                        </span>
                      </div>
                    ))}
                    {arquivosAnexados.length > 3 && (
                      <span style={{ fontSize: 11, color: '#db2777', fontWeight: 700 }}>
                        + {arquivosAnexados.length - 3} outro(s) documento(s)
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                    Nenhum arquivo PDF anexado.
                  </div>
                )}
              </div>

              {/* Canal de Validação */}
              <div style={{
                background: '#ffffff', borderRadius: 14,
                border: '1px solid #e2e8f0', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Canal de Validação
                </span>
                <span style={{
                  fontSize: 12.5, fontWeight: 800,
                  color: authMode === 'tokenWhatsapp' ? '#047857' : '#1d4ed8',
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 2
                }}>
                  {authMode === 'tokenWhatsapp' && <><MessageSquare size={13} /> Notificação por WhatsApp</>}
                  {authMode === 'tokenEmail' && <><Mail size={13} /> Notificação por E-mail</>}
                </span>
              </div>

              {/* Selo de Validade Jurídica */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 5
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1d4ed8', fontSize: 12, fontWeight: 800 }}>
                  <CheckCircle2 size={15} />
                  <span>Validade Jurídica Assegurada</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.45 }}>
                  Assinatura eletrônica certificada com trilha de auditoria completa, IP e carimbo de tempo via ZapSign (MP 2.200-2/2001).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          ABA 2: PAINEL DE ASSINATURAS (LIGHT & ULTRA MODERNO)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'painel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Barra de Filtros e Busca */}
          <div className="mo-card" style={{
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#2563eb', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar por estudante, responsável, telefone, CPF, documento..."
                value={filtroBusca}
                onChange={e => setFiltroBusca(e.target.value)}
                className="mo-input"
                style={{ paddingLeft: 44, paddingRight: filtroBusca ? 40 : 16, height: 44 }}
              />
              {filtroBusca && (
                <button
                  type="button"
                  onClick={() => setFiltroBusca('')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%'
                  }}
                  title="Limpar busca"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                className="mo-input"
                style={{ width: 'auto', minWidth: 200, height: 44, padding: '0 16px', cursor: 'pointer', fontWeight: 600 }}
              >
                <option value="todos">Todos os Status ({contratos.length})</option>
                <option value="aguardando">Aguardando Assinatura ({calculatedMetrics.aguardando})</option>
                <option value="assinado">Assinados ({calculatedMetrics.assinados})</option>
                <option value="recusado">Recusados / Cancelados ({calculatedMetrics.recusados})</option>
              </select>

              <button
                onClick={carregarContratos}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '0 20px',
                  height: 44,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
              >
                <RefreshCw size={14} className={isLoadingContratos ? 'animate-spin' : ''} />
                <span>Atualizar Lista</span>
              </button>
            </div>
          </div>

          {/* Tabela de Contratos (Design Light & Ultra Moderno - 100% Responsiva sem Scroll Horizontal) */}
          <div className="mo-card" style={{ overflow: 'hidden', padding: 0 }}>
            <div className="mo-scroll" style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '19%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 4px 10px 14px', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estudante</th>
                    <th style={{ padding: '10px 4px', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</th>
                    <th style={{ padding: '10px 4px', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa / Contratado</th>
                    <th style={{ padding: '10px 6px', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arquivo</th>
                    <th style={{ padding: '10px 6px', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Envio</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status ZapSign</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingContratos ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 14px', color: '#2563eb' }} />
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Carregando contratos e assinaturas...</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Conectando com a base de dados do ZapSign</div>
                      </td>
                    </tr>
                  ) : contratos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#94a3b8' }}>
                          <FileText size={24} />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Nenhum documento enviado encontrado</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Utilize a aba "Nova Matrícula" para disparar um contrato para assinatura.</div>
                      </td>
                    </tr>
                  ) : contratosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#2563eb' }}>
                          <Search size={22} />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Nenhum contrato encontrado para os filtros aplicados</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {filtroStatus !== 'todos' ? `Filtro de status: "${filtroStatus === 'assinado' ? 'Assinados' : filtroStatus === 'aguardando' ? 'Aguardando Assinatura' : 'Recusados / Cancelados'}". ` : ''}
                          {filtroBusca ? `Busca: "${filtroBusca}".` : ''}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFiltroStatus('todos')
                            setFiltroBusca('')
                          }}
                          style={{
                            marginTop: 14,
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 10,
                            padding: '7px 16px',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.2s'
                          }}
                        >
                          <X size={13} />
                          <span>Limpar Filtros</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    contratosFiltrados.map(c => {
                      const isRecusado = c.status === 'recusado' || c.status === 'cancelado'
                      const progress = getSignersProgress(c)
                      const isAssinado = !isRecusado && (progress.todosAssinaram || c.status === 'assinado')
                      const isAguardando = !isRecusado && !isAssinado

                      return (
                        <tr
                          key={c.id}
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Estudante */}
                          <td style={{ padding: '10px 4px 10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                                color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, fontSize: 11.5, flexShrink: 0
                              }}>
                                {c.aluno_nome ? c.aluno_nome.charAt(0).toUpperCase() : 'A'}
                              </div>
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <div
                                  style={{ fontWeight: 800, color: '#0f172a', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  title={c.aluno_nome || 'Avulso / Sem Estudante'}
                                >
                                  {c.aluno_nome || 'Avulso / Direto'}
                                </div>
                                <div
                                  style={{ fontSize: 10.5, color: '#2563eb', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  title={c.aluno_turma || c.aluno_serie || 'Geral'}
                                >
                                  {c.aluno_turma || c.aluno_serie || 'Geral'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Responsável */}
                          <td style={{ padding: '10px 4px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{ fontWeight: 800, color: '#1e293b', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                title={c.responsavel_nome}
                              >
                                {c.responsavel_nome}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                                {c.responsavel_telefone && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, fontSize: 10.5, color: '#047857', whiteSpace: 'nowrap' }}>
                                    <Smartphone size={10} style={{ flexShrink: 0 }} />
                                    <span>{c.responsavel_telefone}</span>
                                  </span>
                                )}
                              </div>
                              {c.responsavel_email && (
                                <div
                                  style={{ color: '#64748b', fontSize: 10, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  title={c.responsavel_email}
                                >
                                  {c.responsavel_email}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Empresa / Representante (Contratado) */}
                          <td style={{ padding: '10px 4px' }}>
                            {c.metadata?.escolaSignatario ? (
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  title={c.metadata.escolaSignatario.nomeRepresentante || c.metadata.escolaSignatario.nome}
                                >
                                  <Building2 size={11} color="#6d28d9" style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {c.metadata.escolaSignatario.nomeRepresentante || c.metadata.escolaSignatario.nome}
                                  </span>
                                </div>
                                <div
                                  style={{ fontSize: 10.5, color: '#4338ca', fontWeight: 700, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  title={c.metadata.escolaSignatario.razaoSocial}
                                >
                                  {c.metadata.escolaSignatario.razaoSocial}
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  CNPJ: {c.metadata.escolaSignatario.cnpj || '—'}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                                Apenas Contratante
                              </span>
                            )}
                          </td>

                          {/* Arquivo */}
                          <td style={{ padding: '10px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: 6,
                                background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#db2777', flexShrink: 0
                              }}>
                                <FileText size={12} />
                              </div>
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <span
                                  style={{
                                    fontWeight: 700, color: '#334155', fontSize: 11,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block'
                                  }}
                                  title={c.tipo_documento || 'Contrato Anexo'}
                                >
                                  {c.tipo_documento || 'Contrato'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Data */}
                          <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#334155', fontSize: 11 }}>
                              {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                              {new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 8px' }}>
                            {isRecusado ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: '#fee2e2', color: '#b91c1c',
                                border: '1px solid #fca5a5', borderRadius: 20,
                                padding: '3px 8px', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap'
                              }}>
                                <XCircle size={11} />
                                RECUSADO
                              </span>
                            ) : progress.todosAssinaram ? (
                              <div>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: '#ecfdf5', color: '#047857',
                                  border: '1px solid #a7f3d0', borderRadius: 20,
                                  padding: '3px 8px', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap'
                                }}>
                                  <CheckCircle2 size={11} />
                                  ASSINADO ({progress.progressoTexto})
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: '#fef3c7', color: '#b45309',
                                  border: '1px solid #fde68a', borderRadius: 20,
                                  padding: '3px 8px', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap'
                                }}>
                                  <Clock size={11} />
                                  AGUARDANDO ({progress.progressoTexto})
                                </span>
                                {progress.pendentesNomes.length > 0 && (
                                  <div
                                    style={{
                                      fontSize: 10, color: '#b45309', fontWeight: 700, marginTop: 2,
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}
                                    title={`Falta assinar: ${progress.pendentesNomes.join(', ')}`}
                                  >
                                    Falta: {progress.pendentesNomes.join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Ações Rápidas (Organizadas em 2 colunas, um embaixo do outro) */}
                          <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              
                              {/* COLUNA 1: Assinatura / Baixar PDF & Copiar Link */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                {/* Botão Superior Coluna 1 */}
                                {(() => {
                                  const urlEmpresa = getUrlAssinaturaEmpresa(c)
                                  const urlParaAssinar = urlEmpresa || c.zapsign_sign_url
                                  if (urlParaAssinar && !progress.todosAssinaram) {
                                    return (
                                      <a
                                        href={urlParaAssinar}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={urlEmpresa ? `Abrir link para assinar como ${c.metadata?.escolaSignatario?.nomeRepresentante || 'Representante Legal da Escola'}` : 'Abrir link de assinatura'}
                                        style={{
                                          background: urlEmpresa
                                            ? 'linear-gradient(135deg, #6d28d9, #7c3aed)'
                                            : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                          color: '#ffffff', textDecoration: 'none', border: 'none', borderRadius: 7,
                                          padding: '3px 8px', fontSize: 10.5, fontWeight: 800,
                                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                                          boxShadow: urlEmpresa ? '0 2px 5px rgba(109, 40, 217, 0.2)' : '0 2px 5px rgba(37, 99, 235, 0.2)',
                                          transition: 'all 0.2s', whiteSpace: 'nowrap', height: 26, flexShrink: 0
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                                        onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                                      >
                                        <Monitor size={11} />
                                        <span>{urlEmpresa ? 'Assinar (Empresa)' : 'Assinar'}</span>
                                      </a>
                                    )
                                  }
                                  if (c.signed_file_url) {
                                    return (
                                      <a
                                        href={c.signed_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Baixar PDF Oficial Assinado"
                                        style={{
                                          background: 'linear-gradient(135deg, #059669, #10b981)',
                                          color: '#ffffff', textDecoration: 'none', border: 'none', borderRadius: 7,
                                          padding: '3px 8px', fontSize: 10.5, fontWeight: 800,
                                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                                          boxShadow: '0 2px 5px rgba(16, 185, 129, 0.2)',
                                          transition: 'all 0.2s', whiteSpace: 'nowrap', height: 26, flexShrink: 0
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                                        onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                                      >
                                        <Download size={11} />
                                        <span>Baixar PDF</span>
                                      </a>
                                    )
                                  }
                                  return null
                                })()}

                                {/* Botão Inferior Coluna 1: Copiar Link Contratante */}
                                {c.zapsign_sign_url && (() => {
                                  const isCopiedRow = copiedLink === `Link ${c.aluno_nome || 'Contrato'}`
                                  return (
                                    <button
                                      onClick={() => copiarParaTransferencia(c.zapsign_sign_url!, `Link ${c.aluno_nome || 'Contrato'}`)}
                                      title={isCopiedRow ? 'Link copiado com sucesso!' : 'Copiar Link do Contratante'}
                                      style={{
                                        background: isCopiedRow ? '#ecfdf5' : '#ffffff',
                                        border: isCopiedRow ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                                        color: isCopiedRow ? '#047857' : '#334155',
                                        borderRadius: 7,
                                        padding: '3px 8px', height: 26,
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        fontSize: 10.5, fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0
                                      }}
                                      onMouseEnter={e => {
                                        if (!isCopiedRow) {
                                          e.currentTarget.style.background = '#f8fafc'
                                          e.currentTarget.style.borderColor = '#94a3b8'
                                        }
                                      }}
                                      onMouseLeave={e => {
                                        if (!isCopiedRow) {
                                          e.currentTarget.style.background = '#ffffff'
                                          e.currentTarget.style.borderColor = '#cbd5e1'
                                        }
                                      }}
                                    >
                                      {isCopiedRow ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
                                      <span>{isCopiedRow ? 'Copiado!' : 'Copiar Link'}</span>
                                    </button>
                                  )
                                })()}
                              </div>

                              {/* COLUNA 2: WhatsApp & Ações Rápidas (Sincronizar & Excluir) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                {/* Botão Superior Coluna 2: WhatsApp */}
                                {c.responsavel_telefone && c.zapsign_sign_url ? (
                                  <a
                                    href={`https://wa.me/55${c.responsavel_telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      `Olá, ${c.responsavel_nome}! Segue o link do Colégio Impacto para assinatura do documento${c.aluno_nome ? ` de ${c.aluno_nome}` : ''}: ${c.zapsign_sign_url}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Enviar no WhatsApp para o Contratante"
                                    style={{
                                      background: '#ecfdf5',
                                      border: '1px solid #a7f3d0',
                                      color: '#047857', borderRadius: 7,
                                      padding: '3px 8px', height: 26,
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 10.5, fontWeight: 700,
                                      textDecoration: 'none',
                                      transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#d1fae5')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#ecfdf5')}
                                  >
                                    <MessageSquare size={11} />
                                    <span>WhatsApp</span>
                                  </a>
                                ) : (
                                  <div style={{ height: 26 }} />
                                )}

                                {/* Botão Inferior Coluna 2: Sincronizar & Excluir */}
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {/* Sincronizar com ZapSign */}
                                  {c.zapsign_doc_token && (
                                    <button
                                      onClick={() => handleSincronizarStatus(c)}
                                      disabled={sincronizandoId === c.id}
                                      title="Consultar status no ZapSign"
                                      style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        color: '#475569', borderRadius: 7,
                                        width: 26, height: 26, padding: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = '#f8fafc'
                                        e.currentTarget.style.borderColor = '#94a3b8'
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = '#ffffff'
                                        e.currentTarget.style.borderColor = '#cbd5e1'
                                      }}
                                    >
                                      <RefreshCw size={11} className={sincronizandoId === c.id ? 'animate-spin text-blue-600' : ''} />
                                    </button>
                                  )}

                                  {/* Excluir Contrato do Sistema e Cancelar no ZapSign */}
                                  <button
                                    onClick={() => setContratoParaExcluir(c)}
                                    title="Excluir Contrato do Sistema e Cancelar no ZapSign"
                                    style={{
                                      background: '#fff1f2',
                                      border: '1px solid #fecdd3',
                                      color: '#e11d48',
                                      borderRadius: 7,
                                      width: 26, height: 26, padding: 0,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s', flexShrink: 0
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.background = '#ffe4e6'
                                      e.currentTarget.style.borderColor = '#fda4af'
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = '#fff1f2'
                                      e.currentTarget.style.borderColor = '#fecdd3'
                                    }}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          ABA 3: INFORMAÇÕES & VALIDADE JURÍDICA (ULTRA MODERNO)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'modelos' && (
        <div className="mo-card" style={{
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)'
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Segurança e Validade Jurídica pelo ZapSign
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  Como os documentos e contratos anexados possuem plena validade probatória e legal perante a justiça brasileira.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            {/* Card 1: MP 2.200-2 */}
            <div style={{
              background: '#ffffff', borderRadius: 18,
              border: '1px solid #bfdbfe', padding: '22px',
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <ShieldCheck size={18} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1e40af' }}>
                  Medida Provisória nº 2.200-2/2001
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                Institui a Infraestrutura de Chaves Públicas e assegura plena validade jurídica para assinaturas eletrônicas com consentimento mútuo das partes.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11.5, fontWeight: 800 }}>
                <CheckCircle2 size={13} />
                <span>Totalmente respaldado em juízo</span>
              </div>
            </div>

            {/* Card 2: Autenticação Multicanal */}
            <div style={{
              background: '#ffffff', borderRadius: 18,
              border: '1px solid #bbf7d0', padding: '22px',
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <MessageSquare size={18} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#065f46' }}>
                  Autenticação por WhatsApp e E-mail
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                O ZapSign gera um token criptográfico único enviado ao canal escolhido, registrando número de telefone, carimbo de data/hora, IP e geolocalização.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11.5, fontWeight: 800 }}>
                <CheckCircle2 size={13} />
                <span>Identificação unívoca do signatário</span>
              </div>
            </div>

            {/* Card 3: Trilha de Auditoria */}
            <div style={{
              background: '#ffffff', borderRadius: 18,
              border: '1px solid #e9d5ff', padding: '22px',
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: '0 4px 16px rgba(168, 85, 247, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e22ce' }}>
                  <FileSignature size={18} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#6b21a8' }}>
                  Trilha de Auditoria (Audit Trail)
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                Ao final de cada assinatura, o ZapSign anexa uma folha de assinaturas oficial com hash SHA-256 inalterável que certifica a autenticidade do documento.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11.5, fontWeight: 800 }}>
                <CheckCircle2 size={13} />
                <span>Hash criptográfico SHA-256</span>
              </div>
            </div>

            {/* Card 4: Praticidade */}
            <div style={{
              background: '#ffffff', borderRadius: 18,
              border: '1px solid #fde68a', padding: '22px',
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fffbeb', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                  <Sparkles size={18} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>
                  Praticidade para a Família
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                Os pais não precisam imprimir, assinar fisicamente nem escanear nada. Assinam em menos de 1 minuto diretamente na tela do smartphone.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11.5, fontWeight: 800 }}>
                <CheckCircle2 size={13} />
                <span>Experiência 100% digital e ágil</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          ABA 4: CONFIGURAÇÕES ZAPSIGN (ULTRA MODERNO)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="mo-card" style={{
          maxWidth: 780,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            paddingBottom: 20,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)'
              }}>
                <Key size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Configurações da Integração ZapSign
                </h2>
                <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0' }}>
                  Autenticação de API, ambiente de testes e sincronização em tempo real de contratos.
                </p>
              </div>
            </div>

            {/* Status do Token */}
            {(hasTokenConfigurado || zapConfig.apiToken) ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: 11.5,
                fontWeight: 800,
                letterSpacing: '0.04em'
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                CONECTADO À ZAPSIGN
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: 11.5,
                fontWeight: 800,
                letterSpacing: '0.04em'
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
                TOKEN PENDENTE
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Campo Token */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Token da API ZapSign (Bearer Token) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <a
                  href="https://app.zapsign.com.br/configuracoes/integracoes/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11.5, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                >
                  <span>Obter Token no Painel ZapSign</span>
                  <ExternalLink size={12} />
                </a>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showTokenSecret ? 'text' : 'password'}
                  placeholder="Cole aqui seu token de API da ZapSign"
                  value={zapConfig.apiToken}
                  onChange={e => setZapConfig({ ...zapConfig, apiToken: e.target.value.trim() })}
                  className="mo-input"
                  style={{
                    paddingRight: 44,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 13
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowTokenSecret(!showTokenSecret)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6
                  }}
                  title={showTokenSecret ? 'Ocultar Token' : 'Mostrar Token'}
                >
                  {showTokenSecret ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 7, display: 'block' }}>
                No painel da ZapSign: Acesse <strong>Configurações &gt; Integrações &gt; API ZAPSIGN</strong> e copie o Token gerado.
              </span>
            </div>

            {/* Switch Sandbox / Produção */}
            <div style={{
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 20
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Ambiente de Conexão</span>
                  {zapConfig.sandbox ? (
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: 6,
                      background: '#fffbeb',
                      color: '#b45309',
                      fontSize: 10.5,
                      fontWeight: 800,
                      border: '1px solid #fde68a'
                    }}>
                      SANDBOX (TESTES)
                    </span>
                  ) : (
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: 6,
                      background: '#ecfdf5',
                      color: '#065f46',
                      fontSize: 10.5,
                      fontWeight: 800,
                      border: '1px solid #a7f3d0'
                    }}>
                      PRODUÇÃO OFICIAL
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.45 }}>
                  {zapConfig.sandbox
                    ? 'Ativo: Usando sandbox.api.zapsign.com.br. (Atenção: só funciona com token gerado na conta de testes sandbox da ZapSign).'
                    : 'Desativado: Operando em Produção (api.zapsign.com.br). Recomendado para contas normais do app.zapsign.com.br.'
                  }
                </div>
              </div>

              <button
                type="button"
                onClick={() => setZapConfig({ ...zapConfig, sandbox: !zapConfig.sandbox })}
                style={{
                  width: 52,
                  height: 28,
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: zapConfig.sandbox ? '#2563eb' : '#cbd5e1',
                  position: 'relative',
                  transition: 'background 0.2s',
                  padding: 3,
                  flexShrink: 0
                }}
              >
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#ffffff',
                  transform: zapConfig.sandbox ? 'translateX(24px)' : 'translateX(0px)',
                  transition: 'transform 0.2s',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.18)'
                }} />
              </button>
            </div>

            {/* Método Padrão de Validação */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Método Padrão de Envio e Validação
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                {[
                  {
                    id: 'tokenWhatsapp' as const,
                    title: 'WhatsApp Oficial',
                    desc: 'Notificação e token direto no WhatsApp do signatário.',
                    icon: MessageSquare,
                    color: '#059669',
                    activeBorder: '#10b981',
                    activeBg: '#ecfdf5',
                    inactiveBorder: '#e2e8f0',
                    inactiveBg: '#ffffff'
                  },
                  {
                    id: 'tokenEmail' as const,
                    title: 'E-mail Certificado',
                    desc: 'Token de autenticação encaminhado para a caixa postal.',
                    icon: Mail,
                    color: '#2563eb',
                    activeBorder: '#3b82f6',
                    activeBg: '#eff6ff',
                    inactiveBorder: '#e2e8f0',
                    inactiveBg: '#ffffff'
                  }
                ].map(opt => {
                  const isSelected = zapConfig.authModePadrao === opt.id
                  const Icon = opt.icon
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setZapConfig({ ...zapConfig, authModePadrao: opt.id })}
                      style={{
                        background: isSelected ? opt.activeBg : opt.inactiveBg,
                        border: isSelected ? `2px solid ${opt.activeBorder}` : `1px solid ${opt.inactiveBorder}`,
                        borderRadius: 16,
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? `0 4px 16px rgba(0, 0, 0, 0.05)` : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: isSelected ? '#ffffff' : '#f8fafc',
                          border: `1px solid ${isSelected ? opt.activeBorder : '#e2e8f0'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: opt.color
                        }}>
                          <Icon size={16} />
                        </div>
                        {isSelected && (
                          <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: opt.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff'
                          }}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#0f172a' : '#334155' }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>
                          {opt.desc}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* URL do Webhook */}
            <div style={{
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={15} color="#2563eb" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>URL do Webhook do Colégio Impacto</span>
                </div>
                <button
                  type="button"
                  onClick={() => copiarParaTransferencia(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/matriculas/zapsign/webhook`, 'URL do Webhook')}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 8,
                    transition: 'all 0.2s'
                  }}
                >
                  <Copy size={13} />
                  Copiar URL
                </button>
              </div>
              <div style={{
                background: '#ffffff',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 12,
                color: '#1d4ed8',
                wordBreak: 'break-all'
              }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/api/matriculas/zapsign/webhook` : '/api/matriculas/zapsign/webhook'}
              </div>
              <span style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.45 }}>
                Cadastre este endpoint no painel ZapSign (<strong>Configurações &gt; Integrações &gt; Webhooks</strong>) para que os status sejam sincronizados automaticamente em tempo real assim que os responsáveis assinarem.
              </span>
            </div>

            {/* CNPJs e Representantes Oficiais da Escola (Co-Assinatura Bilateral) */}
            <div style={{
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                    color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #c4b5fd'
                  }}>
                    <Building2 size={19} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14.5, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      CNPJs e Representantes da Escola (Co-Assinatura)
                    </h3>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: '2px 0 0' }}>
                      Configure os CNPJs e representantes legais autorizados a assinar pela escola nos contratos bilaterais.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSignatarioEditando(null)
                    setFormSignatario({
                      cnpj: '',
                      razaoSocial: '',
                      nomeRepresentante: '',
                      cpfRepresentante: '',
                      email: '',
                      telefone: '',
                      cargo: 'Representante Legal',
                      isDefault: (zapConfig.signatariosEscola || []).length === 0
                    })
                    setModalSignatarioEscolaAberto(true)
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Novo CNPJ / Signatário</span>
                </button>
              </div>

              {/* Lista de Signatários Cadastrados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(zapConfig.signatariosEscola || []).map((sig) => (
                  <div
                    key={sig.id}
                    style={{
                      background: '#ffffff',
                      border: sig.isDefault ? '1.5px solid #a5b4fc' : '1px solid #e2e8f0',
                      borderRadius: 14,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: sig.isDefault ? '0 4px 14px rgba(99, 102, 241, 0.08)' : '0 1px 2px rgba(15, 23, 42, 0.03)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a' }}>
                          {sig.razaoSocial}
                        </span>
                        {sig.isDefault && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 999,
                            background: '#ecfdf5', color: '#065f46',
                            border: '1px solid #a7f3d0', fontSize: 10, fontWeight: 900,
                            letterSpacing: '0.04em'
                          }}>
                            PADRÃO
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!sig.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDefinirSignatarioPadrao(sig.id)}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#2563eb',
                              borderRadius: 8,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Definir como Padrão
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSignatarioEditando(sig)
                            setFormSignatario({
                              cnpj: sig.cnpj,
                              razaoSocial: sig.razaoSocial,
                              nomeRepresentante: sig.nomeRepresentante,
                              cpfRepresentante: sig.cpfRepresentante || '',
                              email: sig.email,
                              telefone: sig.telefone,
                              cargo: sig.cargo || '',
                              isDefault: Boolean(sig.isDefault)
                            })
                            setModalSignatarioEscolaAberto(true)
                          }}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Edit3 size={11} />
                          <span>Editar</span>
                        </button>
                        {(zapConfig.signatariosEscola || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja remover o signatário "${sig.nomeRepresentante}" (${sig.razaoSocial})?`)) {
                                handleExcluirSignatarioEscola(sig.id)
                              }
                            }}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              borderRadius: 8,
                              padding: '4px 8px',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Remover Signatário"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 11.5, color: '#475569', paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                      <div>
                        <strong style={{ color: '#0f172a' }}>CNPJ:</strong> {sig.cnpj}
                      </div>
                      <div>
                        <strong style={{ color: '#0f172a' }}>Representante:</strong> {sig.nomeRepresentante} {sig.cargo ? `(${sig.cargo})` : ''}
                      </div>
                      <div>
                        <strong style={{ color: '#0f172a' }}>E-mail:</strong> {sig.email}
                      </div>
                      <div>
                        <strong style={{ color: '#0f172a' }}>Celular/WhatsApp:</strong> {sig.telefone}
                      </div>
                      {sig.cpfRepresentante && (
                        <div>
                          <strong style={{ color: '#0f172a' }}>CPF:</strong> {sig.cpfRepresentante}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões Salvar e Testar */}
            <div style={{ display: 'flex', gap: 14, paddingTop: 10 }}>
              <button
                type="button"
                onClick={handleSalvarConfig}
                disabled={isSavingConfig}
                style={{
                  flex: 1,
                  padding: '14px 22px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13.5,
                  fontWeight: 900,
                  cursor: isSavingConfig ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                {isSavingConfig ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                <span>Salvar Configurações</span>
              </button>

              <button
                type="button"
                onClick={handleTestarConexao}
                disabled={isTestingConnection || !zapConfig.apiToken}
                style={{
                  padding: '14px 24px',
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: 13.5,
                  fontWeight: 800,
                  cursor: isTestingConnection || !zapConfig.apiToken ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                {isTestingConnection ? <RefreshCw size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                <span>Testar Conexão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL DE SUCESSO DE ENVIO (ULTRA MODERNO)
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {envioSucessoModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}>
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 24,
                maxWidth: 540,
                width: '100%',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.2), 0 0 30px rgba(16, 185, 129, 0.1)'
              }}
            >
              {/* Header com ícone de Sucesso */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                  border: '1.5px solid #a7f3d0',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
                  flexShrink: 0
                }}>
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                    Documento Enviado com Sucesso!
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#64748b', margin: '3px 0 0' }}>
                    O arquivo foi registrado no ZapSign e o link oficial já está ativo.
                  </p>
                </div>
              </div>

              {/* Informações Resumidas */}
              <div style={{
                background: '#f8fafc',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontSize: 12.5
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} color="#2563eb" />
                    Estudante:
                  </span>
                  <span style={{ color: '#0f172a', fontWeight: 800 }}>{envioSucessoModal.alunoNome}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} color="#db2777" />
                    Arquivo(s):
                  </span>
                  <span style={{ color: '#db2777', fontWeight: 800, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {envioSucessoModal.totalArquivos && envioSucessoModal.totalArquivos > 1
                      ? `Pacote Consolidado (${envioSucessoModal.totalArquivos} arquivos PDF)`
                      : envioSucessoModal.nomeArquivo}
                  </span>
                </div>

                {/* ── SEÇÃO 1: CONTRATANTE (RESPONSÁVEL LEGAL) ── */}
                <div style={{ paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#059669', fontSize: 11.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} />
                      1. CONTRATANTE: {envioSucessoModal.respNome} (Responsável){envioSucessoModal.respCpf ? ` • CPF: ${envioSucessoModal.respCpf}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopiarContratanteModal}
                      style={{
                        background: copiadoContratanteModal ? '#ecfdf5' : 'none',
                        border: copiadoContratanteModal ? '1px solid #a7f3d0' : 'none',
                        borderRadius: 6,
                        padding: '2px 8px',
                        color: copiadoContratanteModal ? '#047857' : '#2563eb',
                        fontSize: 11.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.2s'
                      }}
                    >
                      {copiadoContratanteModal ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                      <span>{copiadoContratanteModal ? 'Copiado!' : 'Copiar Link'}</span>
                    </button>
                  </div>
                  <div style={{
                    background: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #a7f3d0',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 11.5,
                    color: '#065f46',
                    wordBreak: 'break-all',
                    userSelect: 'all'
                  }}>
                    {envioSucessoModal.signUrl}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: envioSucessoModal.whatsappLink ? '1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      animate={copiadoContratanteModal ? { scale: [1, 1.05, 1], transition: { duration: 0.3 } } : {}}
                      onClick={handleCopiarContratanteModal}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: copiadoContratanteModal
                          ? 'linear-gradient(135deg, #059669, #10b981)'
                          : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: copiadoContratanteModal
                          ? '0 4px 14px rgba(16, 185, 129, 0.4)'
                          : '0 2px 8px rgba(37, 99, 235, 0.2)',
                        transition: 'background 0.3s ease, box-shadow 0.3s ease'
                      }}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {copiadoContratanteModal ? (
                          <motion.span
                            key="check"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Check size={15} strokeWidth={3} />
                            <span>Link Copiado com Sucesso!</span>
                          </motion.span>
                        ) : (
                          <motion.span
                            key="copy"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Copy size={14} />
                            <span>Copiar Link Contratante</span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>

                    {envioSucessoModal.whatsappLink && (
                      <a
                        href={envioSucessoModal.whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          color: '#ffffff',
                          textDecoration: 'none',
                          fontSize: 12,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
                        }}
                      >
                        <MessageSquare size={14} />
                        <span>WhatsApp Contratante</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* ── SEÇÃO 2: CONTRATADO (ESCOLA - CNPJ & REPRESENTANTE) ── */}
                {envioSucessoModal.escolaSignatario && (
                  <div style={{ paddingTop: 14, borderTop: '1.5px dashed #c4b5fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: '#6d28d9', fontSize: 11.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building2 size={14} />
                        2. CONTRATADO: {envioSucessoModal.escolaSignatario.razaoSocial || 'Colégio Impacto'}
                      </span>
                      {envioSucessoModal.escolaSignatario.signUrl && (
                        <button
                          type="button"
                          onClick={handleCopiarContratadoModal}
                          style={{
                            background: copiadoContratadoModal ? '#faf5ff' : 'none',
                            border: copiadoContratadoModal ? '1px solid #d8b4fe' : 'none',
                            borderRadius: 6,
                            padding: '2px 8px',
                            color: '#6d28d9',
                            fontSize: 11.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.2s'
                          }}
                        >
                          {copiadoContratadoModal ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                          <span>{copiadoContratadoModal ? 'Copiado!' : 'Copiar Link'}</span>
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: 11.5, color: '#475569', marginBottom: 6 }}>
                      CNPJ: <strong style={{ color: '#0f172a' }}>{envioSucessoModal.escolaSignatario.cnpj || '—'}</strong> • Repr.: <strong style={{ color: '#0f172a' }}>{envioSucessoModal.escolaSignatario.nome}</strong> ({envioSucessoModal.escolaSignatario.cargo || 'Direção'}){envioSucessoModal.escolaSignatario.cpf ? <> • CPF: <strong style={{ color: '#0f172a' }}>{envioSucessoModal.escolaSignatario.cpf}</strong></> : null}
                    </div>

                    {envioSucessoModal.escolaSignatario.signUrl ? (
                      <>
                        <div style={{
                          background: '#faf5ff',
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1.5px solid #d8b4fe',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: 11.5,
                          color: '#6d28d9',
                          wordBreak: 'break-all',
                          userSelect: 'all'
                        }}>
                          {envioSucessoModal.escolaSignatario.signUrl}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: envioSucessoModal.escolaSignatario.whatsappLink ? '1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}>
                          <a
                            href={envioSucessoModal.escolaSignatario.signUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!envioSucessoModal.escolaSignatario?.signUrl) {
                                e.preventDefault()
                                showToast('Link de assinatura do contratado não disponível.', 'error')
                              }
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: 'linear-gradient(135deg, #6d28d9, #7c3aed)',
                              color: '#ffffff',
                              textDecoration: 'none',
                              border: 'none',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              boxShadow: '0 2px 8px rgba(109, 40, 217, 0.25)',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                          >
                            <Monitor size={14} />
                            <span>Abrir Link para Assinar (Contratado)</span>
                            <ExternalLink size={13} style={{ marginLeft: 2 }} />
                          </a>

                          {envioSucessoModal.escolaSignatario.whatsappLink && (
                            <a
                              href={envioSucessoModal.escolaSignatario.whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #059669, #10b981)',
                                color: '#ffffff',
                                textDecoration: 'none',
                                fontSize: 12,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              <MessageSquare size={14} />
                              <span>WhatsApp Direção</span>
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: 10,
                        border: '1px dashed #cbd5e1',
                        fontSize: 11.5,
                        color: '#64748b',
                        fontStyle: 'italic'
                      }}>
                        Aguardando geração do link institucional da escola pela API do ZapSign.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', paddingTop: 2 }}>
                <button
                  type="button"
                  onClick={() => setEnvioSucessoModal(null)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '8px 20px',
                    borderRadius: 10,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
                >
                  Concluir e Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: CADASTRAR / EDITAR SIGNATÁRIO INSTITUCIONAL DA ESCOLA
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalSignatarioEscolaAberto && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}>
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 24,
                maxWidth: 580,
                width: '100%',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.2)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                    color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #c4b5fd'
                  }}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      {signatarioEditando ? 'Editar Signatário da Escola' : 'Novo Signatário da Escola'}
                    </h3>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: '2px 0 0' }}>
                      Dados para assinatura eletrônica bilateral via ZapSign
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModalSignatarioEscolaAberto(false)
                    setSignatarioEditando(null)
                  }}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    borderRadius: 10,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {/* CNPJ */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 5 }}>
                    CNPJ da Instituição *
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={formSignatario.cnpj}
                    onChange={e => setFormSignatario({ ...formSignatario, cnpj: formatarCNPJ(e.target.value) })}
                    className="mo-input"
                    maxLength={18}
                  />
                </div>

                {/* Razão Social */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 5 }}>
                    Razão Social da Escola *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Colégio Impacto LTDA"
                    value={formSignatario.razaoSocial}
                    onChange={e => setFormSignatario({ ...formSignatario, razaoSocial: e.target.value })}
                    className="mo-input"
                  />
                </div>

                {/* Nome Representante */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 5 }}>
                    Nome do Representante *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome completo de quem assina"
                    value={formSignatario.nomeRepresentante}
                    onChange={e => setFormSignatario({ ...formSignatario, nomeRepresentante: e.target.value })}
                    className="mo-input"
                  />
                </div>

                {/* Cargo */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 5 }}>
                    Cargo do Representante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Direção Geral / Secretaria"
                    value={formSignatario.cargo}
                    onChange={e => setFormSignatario({ ...formSignatario, cargo: e.target.value })}
                    className="mo-input"
                  />
                </div>

                {/* CPF Representante */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 5 }}>
                    CPF do Representante <span style={{ color: '#ef4444' }}>*</span> (Obrigatório ZapSign)
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={formSignatario.cpfRepresentante}
                    onChange={e => setFormSignatario({ ...formSignatario, cpfRepresentante: formatarCPF(e.target.value) })}
                    className="mo-input"
                    maxLength={14}
                  />
                </div>

                {/* Celular / WhatsApp */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 5 }}>
                    Celular / WhatsApp com DDD *
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={formSignatario.telefone}
                    onChange={e => setFormSignatario({ ...formSignatario, telefone: formatarTelefone(e.target.value) })}
                    className="mo-input"
                    maxLength={15}
                  />
                </div>

                {/* E-mail Institucional */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 5 }}>
                    E-mail Oficial do Signatário *
                  </label>
                  <input
                    type="email"
                    placeholder="secretaria@escola.com.br"
                    value={formSignatario.email}
                    onChange={e => setFormSignatario({ ...formSignatario, email: e.target.value.trim() })}
                    className="mo-input"
                  />
                </div>

                {/* Checkbox Tornar Padrão */}
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={formSignatario.isDefault}
                      onChange={e => setFormSignatario({ ...formSignatario, isDefault: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: '#4f46e5', cursor: 'pointer' }}
                    />
                    <span>Definir como signatário padrão da instituição nos contratos</span>
                  </label>
                </div>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModalSignatarioEscolaAberto(false)
                    setSignatarioEditando(null)
                  }}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: 12,
                    padding: '10px 18px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSalvarSignatarioEscola(formSignatario)}
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontSize: 12.5,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)'
                  }}
                >
                  <Check size={15} />
                  <span>Salvar Signatário</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL DE ASSINATURA PRESENCIAL / EMBEDDED IFRAME (ULTRA MODERNO)
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalAssinarUrl && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderBottom: 'none',
              borderRadius: '20px 20px 0 0',
              padding: '14px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb'
                }}>
                  <FileSignature size={18} />
                </div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', display: 'block' }}>
                    Assinatura Eletrônica de Matrícula – ZapSign
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Ambiente seguro e criptografado para assinatura presencial no balcão
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={modalAssinarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    textDecoration: 'none',
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s'
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Abrir em Nova Aba</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setModalAssinarUrl(null)
                    carregarContratos()
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  <X size={14} strokeWidth={2.5} />
                  <span>Fechar e Atualizar Status</span>
                </button>
              </div>
            </div>

            <div style={{
              flex: 1,
              background: '#ffffff',
              borderRadius: '0 0 20px 20px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              borderTop: 'none',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)'
            }}>
              <iframe
                src={modalAssinarUrl}
                title="Assinatura ZapSign"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="camera; microphone; geolocation"
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL DE CONFIRMAÇÃO: EXCLUIR CONTRATO DO SISTEMA E DO ZAPSIGN
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {contratoParaExcluir && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                background: '#ffffff',
                border: '1.5px solid #fecdd3',
                borderRadius: 24,
                boxShadow: '0 25px 50px -12px rgba(225, 29, 72, 0.25)',
                width: '100%',
                maxWidth: 480,
                overflow: 'hidden'
              }}
            >
              {/* Header com tom de alerta pastel */}
              <div style={{
                background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
                borderBottom: '1px solid #fecdd3',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 14
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #e11d48, #be123c)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)',
                  flexShrink: 0
                }}>
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#9f1239', margin: 0 }}>
                    Excluir Contrato e Cancelar no ZapSign
                  </h3>
                  <p style={{ fontSize: 12, color: '#e11d48', margin: '3px 0 0', fontWeight: 600 }}>
                    Esta ação é permanente e remove o documento de todas as bases.
                  </p>
                </div>
              </div>

              {/* Conteúdo */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, margin: 0 }}>
                  Você está prestes a excluir o contrato referente ao signatário <strong style={{ color: '#0f172a' }}>{contratoParaExcluir.responsavel_nome}</strong>
                  {contratoParaExcluir.aluno_nome && contratoParaExcluir.aluno_nome !== 'Avulso / Sem Estudante' ? (
                    <> (estudante: <strong style={{ color: '#0f172a' }}>{contratoParaExcluir.aluno_nome}</strong>)</>
                  ) : null}.
                </p>

                <div style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 14,
                  padding: '12px 16px',
                  fontSize: 12,
                  color: '#9f1239',
                  lineHeight: 1.5
                }}>
                  ⚠️ <strong>Atenção:</strong> Se o documento já foi enviado para assinatura, a requisição de cancelamento será transmitida à API do ZapSign para invalidar os links de assinatura ativos.
                </div>
              </div>

              {/* Ações */}
              <div style={{
                background: '#f8fafc',
                borderTop: '1px solid #f1f5f9',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}>
                <button
                  type="button"
                  onClick={() => setContratoParaExcluir(null)}
                  disabled={isExcluindoContrato}
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    color: '#475569',
                    borderRadius: 12,
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarExclusaoContrato}
                  disabled={isExcluindoContrato}
                  style={{
                    background: 'linear-gradient(135deg, #e11d48, #be123c)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: isExcluindoContrato ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(225, 29, 72, 0.3)',
                    opacity: isExcluindoContrato ? 0.7 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  {isExcluindoContrato ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      <span>Sim, Excluir Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
