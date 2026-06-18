'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  Users, Search, Plus, Filter, Download, MoreHorizontal, 
  Trash2, Edit, Eye, Check, X, Camera, Upload, 
  UserPlus, SearchIcon, CreditCard, Calendar, Phone, Mail,
  MapPin, Shield, DoorOpen, HardHat, Briefcase, Tag, Sparkles,
  Loader2, Lock, AlertTriangle, CheckCircle2, Info,
  ChevronUp, ChevronDown, ArrowUpDown, FileText, Sun, Moon, ShieldCheck,
  Lightbulb, CloudSun, CircleDot, Clock, CheckCircle, GraduationCap
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import ImportarAlunosModal from '@/components/alunos/ImportarAlunosModal'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
function formatName(fullName: string) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 2) return fullName // Apenas primeiro e último nome

  // Se o nome já for curto, mantemos
  if (fullName.length <= 15) return fullName

  const first = parts[0]
  const last = parts[parts.length - 1]
  const middles = parts.slice(1, -1).map(m => {
    const lower = m.toLowerCase()
    // Pula preposições comuns em português
    if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(lower)) return ''
    return m[0].toUpperCase() + '.'
  }).filter(Boolean)

  const assembled = [first, ...middles, last].join(' ')
  // Se ainda estiver muito longo, retorna apenas Primeiro e Último
  if (assembled.length > 20 && parts.length > 1) {
    return `${first} ${last}`
  }
  return assembled
}

export default function AlunosPage() {
  const { cfgNiveisEnsino, cfgCalendarioLetivo, logSystemAction } = useData()
  const queryClient = useQueryClient()
  
  const [busca, setBusca] = useState('')
  const [todasTurmas, setTodasTurmas] = useState<any[]>([])
  const [segmentoSelecionado, setSegmentoSelecionado] = useState('')
  const [editingAlunoId, setEditingAlunoId] = useState<string | null>(null)
  const [mostrarFormResponsavel, setMostrarFormResponsavel] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [itensPorPagina, setItensPorPagina] = useState(10)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  
  // Advanced Filters State
  const [isFiltrosAvancadosModalOpen, setIsFiltrosAvancadosModalOpen] = useState(false)
  const [filtrosAvancados, setFiltrosAvancados] = useState({
    dataCadastroInicio: '',
    dataCadastroFim: '',
    inadimplente: 'todos',
    riscoEvasao: 'todos',
    turno: 'todos',
    autorizadoSairSozinho: 'todos'
  })
  
  // Sorting State
  const [sortField, setSortField] = useState('nome')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Export State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'tsv' | 'json' | 'xlsx'>('xlsx')
  const [exportFields, setExportFields] = useState<Record<string, boolean>>({
    // Aluno
    id: true,
    nome: true,
    email: true,
    telefone: true,
    dataNasc: true,
    status: true,
    sairSozinho: true,
    unidade: false,
    turno: false,
    serie: false,
    turma_anoLetivo: true,
    turma_segmento: true,
    turma_nome: true,
    inadimplente: false,
    risco_evasao: false,
    media: false,
    frequencia: false,
    obs: false,
    dataCadastro: true,
    
    // Turma
    historicoTurmas: false,

    // Responsável Financeiro
    respFin_id: true,
    respFin_nome: true,
    respFin_rfid: true,
    respFin_email: true,
    respFin_telefone: true,
    respFin_cpf: true,
    respFin_rg: true,
    respFin_parentesco: true,
    respFin_profissao: true,
    respFin_vinculo: true,
    respFin_tipo: true,
    respFin_diasAcesso: true,
    respFin_proibido: true,

    // Responsável Pedagógico
    respPed_id: true,
    respPed_nome: true,
    respPed_rfid: true,
    respPed_email: true,
    respPed_telefone: true,
    respPed_cpf: true,
    respPed_rg: true,
    respPed_parentesco: true,
    respPed_profissao: true,
    respPed_vinculo: true,
    respPed_tipo: true,
    respPed_diasAcesso: true,
    respPed_proibido: true,

    // Outros
    responsaveisOutros: true
  })
  const [exportFilters, setExportFilters] = useState({
    dateStart: '',
    dateEnd: '',
  })

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
    setPaginaAtual(1)
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const activeFilters: Record<string, string> = {
        all: 'true',
        sortField,
        sortOrder,
        _t: Date.now().toString()
      }
      if (filtrosAvancados.dataCadastroInicio) activeFilters.dataCadastroInicio = filtrosAvancados.dataCadastroInicio
      if (filtrosAvancados.dataCadastroFim) activeFilters.dataCadastroFim = filtrosAvancados.dataCadastroFim
      if (filtrosAvancados.inadimplente !== 'todos') activeFilters.inadimplente = filtrosAvancados.inadimplente
      if (filtrosAvancados.riscoEvasao !== 'todos') activeFilters.riscoEvasao = filtrosAvancados.riscoEvasao
      if (filtrosAvancados.turno !== 'todos') activeFilters.turno = filtrosAvancados.turno
      if (filtrosAvancados.autorizadoSairSozinho !== 'todos') activeFilters.autorizadoSairSozinho = filtrosAvancados.autorizadoSairSozinho

      const params = new URLSearchParams(activeFilters)
      
      const res = await fetch(`/api/alunos?${params.toString()}`, {
        cache: 'no-store'
      })
      const json = await res.json()
      let data = json.data || []
      
      const getLocalDateStr = (dateVal: string | Date) => {
        if (!dateVal) return ''
        try {
          const d = new Date(dateVal)
          if (isNaN(d.getTime())) return ''
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        } catch (e) {
          return ''
        }
      }

      // Filter by registration date if selected
      if (exportFilters.dateStart) {
        data = data.filter((item: any) => {
          const localDate = getLocalDateStr(item.created_at)
          return localDate && localDate >= exportFilters.dateStart
        })
      }
      if (exportFilters.dateEnd) {
        data = data.filter((item: any) => {
          const localDate = getLocalDateStr(item.created_at)
          return localDate && localDate <= exportFilters.dateEnd
        })
      }
      
      if (data.length === 0) {
        alert('Nenhum aluno encontrado para os critérios selecionados.')
        setIsExporting(false)
        return
      }
      
      const formatDateStr = (dateStr: string) => {
        if (!dateStr) return ''
        try {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-')
            return `${d}/${m}/${y}`
          }
          const d = new Date(dateStr)
          if (isNaN(d.getTime())) return dateStr
          const day = String(d.getDate()).padStart(2, '0')
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const year = d.getFullYear()
          return `${day}/${month}/${year}`
        } catch (e) {
          return dateStr
        }
      }

      const formatDiasAcesso = (diasVal: any) => {
        if (!diasVal) return ''
        if (Array.isArray(diasVal)) {
          return diasVal.join(', ')
        }
        if (typeof diasVal === 'string') {
          if (diasVal.startsWith('[') && diasVal.endsWith(']')) {
            try {
              const parsed = JSON.parse(diasVal)
              if (Array.isArray(parsed)) {
                return parsed.join(', ')
              }
            } catch (e) {
              // ignore
            }
          }
          return diasVal
        }
        return String(diasVal)
      }

      const formatParentesco = (p: any) => {
        if (!p) return ''
        const lower = String(p).trim().toLowerCase()
        if (lower === 'mae' || lower === 'mãe') return 'Mãe'
        if (lower === 'pai') return 'Pai'
        if (lower === 'outro') return 'Outro'
        return String(p).charAt(0).toUpperCase() + String(p).slice(1)
      }
      
      const getFinResp = (item: any) => {
        return item.responsaveis?.find((r: any) => r.isFinanceiro || r.respFinanceiro)
      }
      const getPedResp = (item: any) => {
        return item.responsaveis?.find((r: any) => r.isPedagogico || r.respPedagogico)
      }
      const getOtherRespsStr = (item: any) => {
        const fin = getFinResp(item)
        const ped = getPedResp(item)
        const others = item.responsaveis?.filter((r: any) => r.id !== fin?.id && r.id !== ped?.id) || []
        if (others.length === 0) return ''
        return others.map((r: any) => {
          const typeParts: string[] = []
          if (r.isFinanceiro || r.respFinanceiro) typeParts.push('Financeiro')
          if (r.isPedagogico || r.respPedagogico) typeParts.push('Pedagógico')
          if (r.isOutro) typeParts.push('Outro')
          const tipoStr = typeParts.length > 0 ? typeParts.join('/') : 'Outro'
          
          const formatDays = formatDiasAcesso(r.diasAcesso)
          
          return `ID: ${r.id || 'N/A'}, Nome: ${r.nome || 'N/A'}, Parentesco: ${formatParentesco(r.parentesco) || 'N/A'}, Tipo: ${tipoStr}, RFID: ${r.rfid || 'N/A'}, E-mail: ${r.email || 'N/A'}, Tel: ${r.telefone || r.celular || 'N/A'}, Profissão: ${r.profissao || 'N/A'}, Dias: ${formatDays || 'N/A'}, Proibido: ${r.proibido ? 'Sim' : 'Não'}`
        }).join('; ')
      }
      
      const headers: string[] = []
      const rowMapper: ((item: any) => string)[] = []
      
      // --- ALUNO ---
      if (exportFields.id) {
        headers.push('ID/Matrícula')
        rowMapper.push(item => item.matricula || item.codigo || item.id || '')
      }
      if (exportFields.nome) {
        headers.push('Nome Completo')
        rowMapper.push(item => item.nome || '')
      }
      if (exportFields.email) {
        headers.push('E-mail')
        rowMapper.push(item => item.email || '')
      }
      if (exportFields.telefone) {
        headers.push('Telefone')
        rowMapper.push(item => item.telefone || '')
      }
      if (exportFields.dataNasc) {
        headers.push('Data de Nascimento')
        rowMapper.push(item => formatDateStr(item.data_nascimento))
      }
      if (exportFields.status) {
        headers.push('Status')
        rowMapper.push(item => item.status || '')
      }
      if (exportFields.sairSozinho) {
        headers.push('Autorizado Sair Sozinho')
        rowMapper.push(item => {
          const val = item.autorizadoSairSozinho !== undefined ? item.autorizadoSairSozinho : item.dados?.autorizadoSairSozinho
          return val ? 'Sim' : 'Não'
        })
      }
      if (exportFields.unidade) {
        headers.push('Unidade Escolar')
        rowMapper.push(item => item.unidade || '')
      }
      if (exportFields.turno) {
        headers.push('Turno')
        rowMapper.push(item => item.turno || '')
      }
      if (exportFields.serie) {
        headers.push('Série')
        rowMapper.push(item => item.serie || '')
      }

      const getTurmaObj = (item: any) => {
        if (!item.turma) return null
        return todasTurmas.find((t: any) => 
          String(t.id) === String(item.turma) || 
          String(t.codigo) === String(item.turma) ||
          String(t.nome).toLowerCase() === String(item.turma).toLowerCase()
        )
      }
      
      if (exportFields.turma_anoLetivo) {
        headers.push('Ano Letivo')
        rowMapper.push(item => {
          if (item.turma_anoLetivo) return String(item.turma_anoLetivo)
          const tObj = getTurmaObj(item)
          return tObj?.ano !== undefined ? String(tObj.ano) : (item.anoLetivo || item.ano_letivo || item.dados?.anoLetivo || '')
        })
      }
      if (exportFields.turma_segmento) {
        headers.push('Segmento')
        rowMapper.push(item => {
          if (item.turma_segmento) return item.turma_segmento
          const tObj = getTurmaObj(item)
          return tObj?.dados?.segmento || item.segmento || item.dados?.segmento || ''
        })
      }
      if (exportFields.turma_nome) {
        headers.push('Nome da Turma')
        rowMapper.push(item => {
          if (item.turma_nome) return item.turma_nome
          return getTurmaObj(item)?.nome || item.turma || ''
        })
      }

      if (exportFields.inadimplente) {
        headers.push('Inadimplente')
        rowMapper.push(item => item.inadimplente ? 'Sim' : 'Não')
      }
      if (exportFields.risco_evasao) {
        headers.push('Risco de Evasão')
        rowMapper.push(item => {
          const val = item.risco_evasao || 'baixo'
          return val.charAt(0).toUpperCase() + val.slice(1)
        })
      }
      if (exportFields.media) {
        headers.push('Média')
        rowMapper.push(item => (item.media !== undefined && item.media !== null) ? String(item.media) : '')
      }
      if (exportFields.frequencia) {
        headers.push('Frequência (%)')
        rowMapper.push(item => (item.frequencia !== undefined && item.frequencia !== null) ? `${item.frequencia}%` : '')
      }
      if (exportFields.obs) {
        headers.push('Observações')
        rowMapper.push(item => item.obs || '')
      }
      if (exportFields.dataCadastro) {
        headers.push('Data de Cadastro')
        rowMapper.push(item => formatDateStr(item.created_at))
      }
      
      // --- TURMA ---
      if (exportFields.historicoTurmas) {
        headers.push('Histórico de Turmas')
        rowMapper.push(item => {
          const hList = item.historicoTurmas || item.dados?.historicoTurmas || []
          if (hList.length === 0) return ''
          return hList.map((h: any) => `${h.anoLetivo}: ${todasTurmas.find((t: any) => String(t.id) === String(h.serieTurma))?.nome || h.serieTurma} (${h.status || 'N/A'})`).join('; ')
        })
      }
      
      // --- RESP FINANCEIRO ---
      if (exportFields.respFin_id) {
        headers.push('Fin: ID')
        rowMapper.push(item => getFinResp(item)?.id || '')
      }
      if (exportFields.respFin_nome) {
        headers.push('Fin: Nome')
        rowMapper.push(item => getFinResp(item)?.nome || item.responsavel_financeiro || item.responsavelFinanceiro || '')
      }
      if (exportFields.respFin_rfid) {
        headers.push('Fin: RFID')
        rowMapper.push(item => getFinResp(item)?.rfid || '')
      }
      if (exportFields.respFin_email) {
        headers.push('Fin: E-mail')
        rowMapper.push(item => getFinResp(item)?.email || item.emailResponsavelFinanceiro || item.email_responsavel_financeiro || '')
      }
      if (exportFields.respFin_telefone) {
        headers.push('Fin: Telefone')
        rowMapper.push(item => {
          const resp = getFinResp(item)
          return resp?.telefone || resp?.celular || resp?.dados?.celular || item.telResponsavelFinanceiro || item.tel_responsavel_financeiro || ''
        })
      }
      if (exportFields.respFin_cpf) {
        headers.push('Fin: CPF')
        rowMapper.push(item => getFinResp(item)?.dados?.cpf || getFinResp(item)?.cpf || item.cpfResponsavelFinanceiro || '')
      }
      if (exportFields.respFin_rg) {
        headers.push('Fin: RG')
        rowMapper.push(item => getFinResp(item)?.dados?.rg || getFinResp(item)?.rg || item.rgResponsavelFinanceiro || '')
      }
      if (exportFields.respFin_parentesco) {
        headers.push('Fin: Parentesco')
        rowMapper.push(item => formatParentesco(getFinResp(item)?.parentesco || item.parentescoResponsavelFinanceiro))
      }
      if (exportFields.respFin_profissao) {
        headers.push('Fin: Profissão')
        rowMapper.push(item => getFinResp(item)?.profissao || '')
      }
      if (exportFields.respFin_vinculo) {
        headers.push('Fin: Vínculo')
        rowMapper.push(item => item.matricula || item.codigo || item.id || '')
      }
      if (exportFields.respFin_tipo) {
        headers.push('Fin: Tipo de Responsável')
        rowMapper.push(item => {
          const resp = getFinResp(item)
          if (!resp) {
            return (item.responsavel_financeiro || item.responsavelFinanceiro) ? 'Financeiro' : ''
          }
          const parts = ['Financeiro']
          if (resp.isPedagogico || resp.respPedagogico) parts.push('Pedagógico')
          return parts.join('/')
        })
      }
      if (exportFields.respFin_diasAcesso) {
        headers.push('Fin: Dias Permitidos Retirada')
        rowMapper.push(item => formatDiasAcesso(getFinResp(item)?.diasAcesso || getFinResp(item)?.dias_acesso))
      }
      if (exportFields.respFin_proibido) {
        headers.push('Fin: Acesso Restrito')
        rowMapper.push(item => {
          const resp = getFinResp(item)
          if (!resp) return 'Não'
          return resp.proibido ? 'Sim' : 'Não'
        })
      }
      
      // --- RESP PEDAGÓGICO ---
      if (exportFields.respPed_id) {
        headers.push('Ped: ID')
        rowMapper.push(item => getPedResp(item)?.id || '')
      }
      if (exportFields.respPed_nome) {
        headers.push('Ped: Nome')
        rowMapper.push(item => getPedResp(item)?.nome || item.responsavel_pedagogico || item.responsavelPedagogico || '')
      }
      if (exportFields.respPed_rfid) {
        headers.push('Ped: RFID')
        rowMapper.push(item => getPedResp(item)?.rfid || '')
      }
      if (exportFields.respPed_email) {
        headers.push('Ped: E-mail')
        rowMapper.push(item => getPedResp(item)?.email || item.emailResponsavelPedagogico || item.email_responsavel_pedagogico || '')
      }
      if (exportFields.respPed_telefone) {
        headers.push('Ped: Telefone')
        rowMapper.push(item => {
          const resp = getPedResp(item)
          return resp?.telefone || resp?.celular || resp?.dados?.celular || item.telResponsavelPedagogico || item.tel_responsavel_pedagogico || ''
        })
      }
      if (exportFields.respPed_cpf) {
        headers.push('Ped: CPF')
        rowMapper.push(item => getPedResp(item)?.dados?.cpf || getPedResp(item)?.cpf || item.cpfResponsavelPedagogico || '')
      }
      if (exportFields.respPed_rg) {
        headers.push('Ped: RG')
        rowMapper.push(item => getPedResp(item)?.dados?.rg || getPedResp(item)?.rg || item.rgResponsavelPedagogico || '')
      }
      if (exportFields.respPed_parentesco) {
        headers.push('Ped: Parentesco')
        rowMapper.push(item => formatParentesco(getPedResp(item)?.parentesco || item.parentescoResponsavelPedagogico))
      }
      if (exportFields.respPed_profissao) {
        headers.push('Ped: Profissão')
        rowMapper.push(item => getPedResp(item)?.profissao || '')
      }
      if (exportFields.respPed_vinculo) {
        headers.push('Ped: Vínculo')
        rowMapper.push(item => item.matricula || item.codigo || item.id || '')
      }
      if (exportFields.respPed_tipo) {
        headers.push('Ped: Tipo de Responsável')
        rowMapper.push(item => {
          const resp = getPedResp(item)
          if (!resp) {
            return (item.responsavel_pedagogico || item.responsavelPedagogico) ? 'Pedagógico' : ''
          }
          const parts = []
          if (resp.isFinanceiro || resp.respFinanceiro) parts.push('Financeiro')
          parts.push('Pedagógico')
          return parts.join('/')
        })
      }
      if (exportFields.respPed_diasAcesso) {
        headers.push('Ped: Dias Permitidos Retirada')
        rowMapper.push(item => formatDiasAcesso(getPedResp(item)?.diasAcesso || getPedResp(item)?.dias_acesso))
      }
      if (exportFields.respPed_proibido) {
        headers.push('Ped: Acesso Restrito')
        rowMapper.push(item => {
          const resp = getPedResp(item)
          if (!resp) return 'Não'
          return resp.proibido ? 'Sim' : 'Não'
        })
      }
      
      // --- OUTROS ---
      if (exportFields.responsaveisOutros) {
        headers.push('Outros Responsáveis')
        rowMapper.push(item => getOtherRespsStr(item))
      }
      
      let fileContent: any = ''
      let fileExtension = 'csv'
      let mimeType = 'text/csv;charset=utf-8;'
      
      if (exportFormat === 'xlsx') {
        const tableData = data.map((item: any) => {
          const row: Record<string, string> = {}
          headers.forEach((h, i) => {
            row[h] = rowMapper[i](item)
          })
          return row
        })
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(tableData)
        XLSX.utils.book_append_sheet(wb, ws, 'Alunos')
        XLSX.writeFile(wb, `relatorio_alunos_${Date.now()}.xlsx`)
      } else if (exportFormat === 'csv') {
        const csvRows = [
          headers.join(';'),
          ...data.map((item: any) => 
            rowMapper.map(fn => {
              const val = fn(item)
              const escaped = String(val).replace(/"/g, '""')
              return `"${escaped}"`
            }).join(';')
          )
        ]
        fileContent = '\uFEFF' + csvRows.join('\n')
      } else if (exportFormat === 'tsv') {
        const tsvRows = [
          headers.join('\t'),
          ...data.map((item: any) => 
            rowMapper.map(fn => {
              const val = fn(item)
              const escaped = String(val).replace(/"/g, '""')
              return `"${escaped}"`
            }).join('\t')
          )
        ]
        fileContent = '\uFEFF' + tsvRows.join('\n')
        fileExtension = 'txt'
        mimeType = 'text/tab-separated-values;charset=utf-8;'
      } else if (exportFormat === 'json') {
        const jsonObjects = data.map((item: any) => {
          const obj: any = {}
          headers.forEach((h, i) => {
            obj[h] = rowMapper[i](item)
          })
          return obj
        })
        fileContent = JSON.stringify(jsonObjects, null, 2)
        fileExtension = 'json'
        mimeType = 'application/json;charset=utf-8;'
      }
      
      if (exportFormat !== 'xlsx') {
        const blob = new Blob([fileContent], { type: mimeType })
        const downloadLink = document.createElement('a')
        const downloadUrl = URL.createObjectURL(blob)
        downloadLink.setAttribute('href', downloadUrl)
        downloadLink.setAttribute('download', `relatorio_alunos_${Date.now()}.${fileExtension}`)
        downloadLink.style.visibility = 'hidden'
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
      }
      
      logSystemAction(
        'Acadêmico (Alunos)',
        'Exportação',
        `Exportado relatório de alunos contendo ${data.length} registros no formato ${exportFormat.toUpperCase()}`
      )
      
      setIsExportModalOpen(false)
    } catch (err: any) {
      console.error('Error exporting data:', err)
      alert(`Erro ao exportar dados: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    step: 'password' | 'deleting' | 'success' | 'error';
    passwordValue: string;
    progress: number;
    count: number;
    errorMsg: string;
    wrongPasswordError: boolean;
  }>({
    open: false,
    step: 'password',
    passwordValue: '',
    progress: 0,
    count: 0,
    errorMsg: '',
    wrongPasswordError: false
  })
  const [activeTab, setActiveTab] = useState('aluno') // 'aluno', 'responsavel', 'turma'
  const [buscaResponsavel, setBuscaResponsavel] = useState('')
  const [resultadosResponsaveis, setResultadosResponsaveis] = useState<any[]>([])
  const [loadingBuscaResp, setLoadingBuscaResp] = useState(false)
  const [validationErrors, setValidationErrors] = useState<any[]>([])
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false)
  const hasError = (fieldId: string) => validationErrors.some(e => e.field === fieldId)

  const handleBuscarResponsavel = async () => {
    if (!buscaResponsavel.trim()) return
    setLoadingBuscaResp(true)
    try {
      const res = await fetch(`/api/responsaveis?search=${buscaResponsavel}`)
      const json = await res.json()
      setResultadosResponsaveis(json.data || [])
    } catch (e) {
      console.error('Error searching responsibles:', e)
    } finally {
      setLoadingBuscaResp(false)
    }
  }

  // Query para buscar alunos (Cache via React Query)
  const { data: apiResponse, isLoading: loading, isFetching } = useApiQuery<{ data: any[], total: number }>(
    ['alunos'],
    '/api/alunos',
    { 
      page: paginaAtual, 
      limit: itensPorPagina, 
      search: busca, 
      status: statusFiltro,
      sortField,
      sortOrder,
      ...(filtrosAvancados.dataCadastroInicio ? { dataCadastroInicio: filtrosAvancados.dataCadastroInicio } : {}),
      ...(filtrosAvancados.dataCadastroFim ? { dataCadastroFim: filtrosAvancados.dataCadastroFim } : {}),
      ...(filtrosAvancados.inadimplente !== 'todos' ? { inadimplente: filtrosAvancados.inadimplente } : {}),
      ...(filtrosAvancados.riscoEvasao !== 'todos' ? { riscoEvasao: filtrosAvancados.riscoEvasao } : {}),
      ...(filtrosAvancados.turno !== 'todos' ? { turno: filtrosAvancados.turno } : {}),
      ...(filtrosAvancados.autorizadoSairSozinho !== 'todos' ? { autorizadoSairSozinho: filtrosAvancados.autorizadoSairSozinho } : {})
    }
  )

  const alunos = apiResponse?.data || []
  const total = apiResponse?.total || 0

  useEffect(() => {
    const fetchTodasTurmas = async () => {
      try {
        const res = await fetch('/api/turmas?limit=1000')
        const json = await res.json()
        if (json.data) {
          setTodasTurmas(json.data)
        }
      } catch (e) {
        console.error('Error fetching turmas:', e)
      }
    }
    fetchTodasTurmas()
  }, [])

  // Form State
  const [formData, setFormData] = useState({
    aluno: {
      foto: null,
      codigo: '',
      nome: '',
      dataNasc: '',
      telefone: '',
      email: '',
      ativo: true,
      autorizadoSairSozinho: false
    },
    responsaveis: [{
      id: Math.floor(1000000 + Math.random() * 9000000).toString(),
      nome: '',
      dataNasc: '',
      email: '',
      telefone: '',
      profissao: '',
      codigo: Math.floor(1000000 + Math.random() * 9000000).toString(),
      codigoAluno: '',
      rfid: '',
      parentesco: '',
      diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
      isFinanceiro: false,
      isPedagogico: false,
      isOutro: false,
      proibido: false
    }],
    historicoTurmas: [] as any[]
  })

  const handleInputChange = (section: string, field: string, value: any, index?: number) => {
    setFormData(prev => {
      if (index !== undefined && section === 'responsaveis') {
        const newArray = [...prev.responsaveis]
        
        // Regra 2: Apenas 1 responsável pode ser financeiro
        if (field === 'isFinanceiro' && value === true) {
          newArray.forEach((resp, i) => {
            if (i !== index) newArray[i] = { ...newArray[i], isFinanceiro: false }
          })
        }

        let updatedResp = { ...newArray[index], [field]: value }

        // Regra 1: Pai e Mãe devem ser pelo menos Pedagógico ou Financeiro
        if (field === 'parentesco' && (value === 'pai' || value === 'mae')) {
          if (!updatedResp.isFinanceiro) {
            updatedResp.isPedagogico = true
          }
          updatedResp.isOutro = false
        }
        
        // Regra 3: O tipo de responsável 'outro' marca o tipo 'outro' automaticamente
        if (field === 'parentesco' && value === 'outro') {
          updatedResp.isOutro = true
        }

        // Regra 1 (prevenção): Se for pai/mãe, não deixa desmarcar Pedagógico manualmente SE não for financeiro
        if (field === 'isPedagogico' && value === false && (updatedResp.parentesco === 'pai' || updatedResp.parentesco === 'mae')) {
          if (!updatedResp.isFinanceiro) {
            updatedResp.isPedagogico = true // Força a ser true
          }
        }

        // Regra 1 (prevenção extra): Se desmarcar o financeiro de um pai/mãe, ele volta a ser pedagógico obrigatoriamente
        if (field === 'isFinanceiro' && value === false && (updatedResp.parentesco === 'pai' || updatedResp.parentesco === 'mae')) {
          updatedResp.isPedagogico = true
        }

        newArray[index] = updatedResp
        return { ...prev, responsaveis: newArray }
      }
      return {
        ...prev,
        [section]: {
          ...prev[section as keyof typeof prev],
          [field]: value
        }
      }
    })
  }

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen)
    setValidationErrors([])
    setIsValidationModalOpen(false)
    if (!isModalOpen) {
      setActiveTab('aluno') // Reset to first tab when opening
    }
  }

  const handleNovoAluno = () => {
    const randCode = Math.floor(1000000 + Math.random() * 9000000).toString();
    setFormData({
      aluno: {
        codigo: '', nome: '', dataNasc: '', telefone: '', email: '', ativo: true, autorizadoSairSozinho: false, foto: null
      },
      responsaveis: [{
        id: randCode, nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: randCode, codigoAluno: '', rfid: '', parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false
      }],
      historicoTurmas: []
    })
    setEditingAlunoId(null)
    setMostrarFormResponsavel(false)
    setIsModalOpen(true)
    setActiveTab('aluno')
    setValidationErrors([])
    setIsValidationModalOpen(false)
  }

  const totalPaginas = Math.ceil(total / itensPorPagina)
  const alunosPaginados = alunos

  const validateForm = () => {
    const errors: any[] = []

    // 1. Aluno validation
    if (!formData.aluno.codigo || !formData.aluno.codigo.trim()) {
      errors.push({ field: 'codigo', label: 'ID do Aluno', tab: 'aluno', tabLabel: 'Dados do Aluno' })
    }
    if (!formData.aluno.nome || !formData.aluno.nome.trim()) {
      errors.push({ field: 'nome', label: 'Nome Completo do Aluno', tab: 'aluno', tabLabel: 'Dados do Aluno' })
    }
    if (!formData.aluno.dataNasc || !formData.aluno.dataNasc.trim()) {
      errors.push({ field: 'dataNasc', label: 'Data de Nascimento do Aluno', tab: 'aluno', tabLabel: 'Dados do Aluno' })
    }

    // 2. Responsáveis validation
    if (formData.responsaveis.length === 0) {
      errors.push({ field: 'responsaveis_empty', label: 'Pelo menos um responsável deve ser cadastrado', tab: 'responsavel', tabLabel: 'Responsáveis' })
    } else {
      formData.responsaveis.forEach((resp, index) => {
        const suffix = ` (Responsável #${index + 1})`
        const respId = resp.codigo || resp.id || ''
        if (!respId || !respId.trim()) {
          errors.push({ field: `resp_${index}_id`, label: `ID${suffix}`, tab: 'responsavel', tabLabel: 'Responsáveis' })
        }
        if (!resp.nome || !resp.nome.trim()) {
          errors.push({ field: `resp_${index}_nome`, label: `Nome Completo${suffix}`, tab: 'responsavel', tabLabel: 'Responsáveis' })
        }
        if (!resp.parentesco || !resp.parentesco.trim()) {
          errors.push({ field: `resp_${index}_parentesco`, label: `Parentesco${suffix}`, tab: 'responsavel', tabLabel: 'Responsáveis' })
        }
        if (!resp.isFinanceiro && !resp.isPedagogico && !resp.isOutro && resp.parentesco !== 'outro') {
          errors.push({ field: `resp_${index}_tipo`, label: `Tipo de Responsável (Selecione pelo menos um: Financeiro, Pedagógico ou Outro)${suffix}`, tab: 'responsavel', tabLabel: 'Responsáveis' })
        }
        
        if ((resp.parentesco === 'pai' || resp.parentesco === 'mae') && !resp.isPedagogico && !resp.isFinanceiro) {
          errors.push({ field: `resp_${index}_tipo`, label: `O pai ou mãe deve ser marcado pelo menos como responsável pedagógico ou financeiro${suffix}`, tab: 'responsavel', tabLabel: 'Responsáveis' })
        }
      })
      
      const qtdFinanceiro = formData.responsaveis.filter(r => r.isFinanceiro).length
      if (qtdFinanceiro > 1) {
        errors.push({ field: 'responsaveis_financeiro', label: 'Apenas UM responsável pode ser definido como Financeiro', tab: 'responsavel', tabLabel: 'Responsáveis' })
      }
    }

    // 3. Turma validation
    if (!formData.historicoTurmas || formData.historicoTurmas.length === 0) {
      errors.push({ field: 'historico_empty', label: 'Adicione pelo menos um vínculo de turma', tab: 'turma', tabLabel: 'Vínculo de Turma' })
    } else {
      formData.historicoTurmas.forEach((hist, index) => {
        const suffix = ` (Vínculo #${index + 1})`
        if (!hist.anoLetivo) errors.push({ field: `hist_${index}_anoLetivo`, label: `Ano Letivo${suffix}`, tab: 'turma', tabLabel: 'Vínculo de Turma' })
        if (!hist.serieTurma) errors.push({ field: `hist_${index}_serieTurma`, label: `Série / Turma${suffix}`, tab: 'turma', tabLabel: 'Vínculo de Turma' })
      })
    }

    return errors
  }

  const handleSave = async () => {
    const errors = validateForm()
    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsValidationModalOpen(true)
      return
    }

    const newAluno = {
      id: editingAlunoId || `TEMP-${Date.now()}`,
      ...formData.aluno,
      responsavel: formData.responsaveis[0] || null,
      responsaveis: formData.responsaveis,
      historicoTurmas: formData.historicoTurmas
    }
    
    const method = editingAlunoId ? 'PUT' : 'POST'
    const url = editingAlunoId ? `/api/alunos?id=${editingAlunoId}` : '/api/alunos'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAluno)
      })

      if (res.ok) {
        const savedData = await res.json()
        const realId = savedData.id || editingAlunoId || newAluno.id
        logSystemAction(
          'Acadêmico (Alunos)',
          editingAlunoId ? 'Edição' : 'Cadastro',
          `${editingAlunoId ? 'Atualização' : 'Cadastro'} do aluno ${newAluno.nome}`,
          { registroId: realId, detalhesDepois: newAluno }
        )
        queryClient.invalidateQueries({ queryKey: ['alunos'] })
        toggleModal()
        setEditingAlunoId(null)
      } else {
        const err = await res.json()
        alert(`Erro ao salvar: ${err.error}`)
      }
    } catch (e: any) {
      alert(`Erro na requisição: ${e.message}`)
    }
  }

  const handleEdit = (aluno: any) => {
    const turmaDoAluno = todasTurmas.find((t: any) => 
      String(t.id) === String(aluno.turma) || 
      t.nome === aluno.turma
    )
    const segmento = turmaDoAluno?.dados?.segmento || ''
    setSegmentoSelecionado(segmento)

    setFormData({
      aluno: {
        codigo: aluno.matricula || aluno.codigo || '',
        nome: aluno.nome || '',
        dataNasc: aluno.data_nascimento || aluno.dataNasc || '',
        telefone: aluno.telefone || '',
        email: aluno.email || '',
        ativo: aluno.status === 'Ativo' || aluno.status === 'matriculado',
        autorizadoSairSozinho: aluno.autorizadoSairSozinho || false,
        foto: aluno.foto || null
      },
      responsaveis: (aluno.responsaveis 
        ? aluno.responsaveis 
        : (aluno.responsavel 
            ? [typeof aluno.responsavel === 'string' ? { nome: aluno.responsavel } : aluno.responsavel] 
            : [{ id: '', nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: '', codigoAluno: '', rfid: '', parentesco: '' }]
          )
      ).map((r: any) => ({ 
        id: '', nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: '', codigoAluno: '', rfid: '', parentesco: '', 
        ...r, 
        diasAcesso: r.diasAcesso || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] 
      })),
      historicoTurmas: (aluno.dados?.historicoTurmas && aluno.dados.historicoTurmas.length > 0) 
        ? aluno.dados.historicoTurmas 
        : (aluno.turma ? [{
            id: `HIST-${Date.now()}`,
            anoLetivo: aluno.dados?.anoLetivo || aluno.ano_letivo || new Date().getFullYear().toString(),
            segmento: segmento,
            serieTurma: turmaDoAluno?.id || aluno.turma || '',
            status: 'Matriculado'
          }] : [])
    })
    setEditingAlunoId(aluno.id)
    setMostrarFormResponsavel(!!aluno.responsavel)
    setIsModalOpen(true)
    setActiveTab('aluno')
    setValidationErrors([])
    setIsValidationModalOpen(false)
  }

  const toggleStatus = async (aluno: any) => {
    const isAtivo = aluno.status === 'Ativo' || aluno.status === 'matriculado';
    const updated = { 
      ...aluno, 
      status: isAtivo ? 'inativo' : 'matriculado',
      ativo: !isAtivo
    }
    const res = await fetch(`/api/alunos?id=${aluno.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    })
    if (res.ok) {
      logSystemAction(
        'Acadêmico (Alunos)',
        'Edição',
        `${!isAtivo ? 'Ativação' : 'Desativação'} do aluno ${aluno.nome}`,
        { registroId: aluno.id, detalhesDepois: updated }
      )
      queryClient.invalidateQueries({ queryKey: ['alunos'] })
    } else {
      alert('Erro ao atualizar status do aluno')
    }
  }

  const toggleSairSozinho = async (aluno: any) => {
    const updated = { ...aluno, autorizadoSairSozinho: !aluno.autorizadoSairSozinho }
    const res = await fetch(`/api/alunos?id=${aluno.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    })
    if (res.ok) {
      logSystemAction(
        'Acadêmico (Alunos)',
        'Edição',
        `Alteração de permissão de saída do aluno ${aluno.nome}`,
        { registroId: aluno.id, detalhesDepois: updated }
      )
      queryClient.invalidateQueries({ queryKey: ['alunos'] })
    } else {
      alert('Erro ao atualizar permissão de saída')
    }
  }

  const handleDelete = async (id: string) => {
    const alunoExcluido = apiResponse?.data?.find((a: any) => a.id === id)
    const nomeAluno = alunoExcluido?.nome || id
    if (confirm(`Deseja realmente excluir o aluno ${nomeAluno}?`)) {
      const res = await fetch(`/api/alunos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        logSystemAction(
          'Acadêmico (Alunos)',
          'Exclusão',
          `Exclusão do aluno ${nomeAluno}`,
          { registroId: id, detalhesAntes: alunoExcluido }
        )
        queryClient.invalidateQueries({ queryKey: ['alunos'] })
      } else {
        alert('Erro ao excluir aluno')
      }
    }
  }

  const handleDeleteAll = () => {
    setDeleteModal({
      open: true,
      step: 'password',
      passwordValue: '',
      progress: 0,
      count: 0,
      errorMsg: '',
      wrongPasswordError: false
    })
  }

  const handleConfirmDeleteAllPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (deleteModal.passwordValue !== 'CONFIRMAR') {
      setDeleteModal(prev => ({ ...prev, wrongPasswordError: true }))
      setTimeout(() => {
        setDeleteModal(prev => ({ ...prev, wrongPasswordError: false }))
      }, 1000)
      return
    }

    setDeleteModal(prev => ({ ...prev, step: 'deleting', progress: 0 }))

    let currentProgress = 0
    let apiCompleted = false
    let apiSuccess = false
    let deletedCount = 0
    let apiErrorMsg = ''

    const interval = setInterval(() => {
      if (currentProgress < 96 || (currentProgress < 100 && apiCompleted)) {
        currentProgress += 2
        setDeleteModal(prev => ({ ...prev, progress: currentProgress }))
      } else if (currentProgress >= 100 && apiCompleted) {
        clearInterval(interval)
        if (apiSuccess) {
          logSystemAction(
            'Acadêmico (Alunos)',
            'Exclusão',
            'Exclusão em lote de todos os alunos do sistema',
            { detalhesAntes: 'Todos os alunos cadastrados' }
          )
          queryClient.invalidateQueries({ queryKey: ['alunos'] })
          setDeleteModal(prev => ({ ...prev, step: 'success', count: deletedCount }))
        } else {
          setDeleteModal(prev => ({ ...prev, step: 'error', errorMsg: apiErrorMsg }))
        }
      }
    }, 50)

    try {
      const res = await fetch('/api/alunos?all=true', { method: 'DELETE' })
      if (res.ok) {
        const result = await res.json()
        deletedCount = result.count || 0
        apiSuccess = true
      } else {
        const err = await res.json()
        apiErrorMsg = err.error || 'Erro na requisição'
      }
    } catch (err: any) {
      apiErrorMsg = err.message || 'Erro inesperado'
    } finally {
      apiCompleted = true
    }
  }

  const getPaginasExibidas = () => {
    const paginas: (number | string)[] = []
    const limiteBordas = 2
    
    if (totalPaginas <= 7) {
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i)
      }
      return paginas
    }

    paginas.push(1)

    let inicio = Math.max(2, paginaAtual - limiteBordas)
    let fim = Math.min(totalPaginas - 1, paginaAtual + limiteBordas)

    if (paginaAtual <= limiteBordas + 1) {
      fim = limiteBordas * 2 + 1
    }
    if (paginaAtual >= totalPaginas - limiteBordas) {
      inicio = totalPaginas - limiteBordas * 2
    }

    if (inicio > 2) {
      paginas.push('...')
    }

    for (let i = inicio; i <= fim; i++) {
      paginas.push(i)
    }

    if (fim < totalPaginas - 1) {
      paginas.push('...')
    }

    paginas.push(totalPaginas)
    return paginas
  }


  return (
    <>

      <style>{`
        /* Ultra Modern Custom Styles */
        .glass-card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.05);
          border-radius: 24px;
        }
        
        .ultra-modal {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(30px) !important;
          border: 1px solid rgba(255, 255, 255, 0.7) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
        }
        
        .dark .glass-card {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .neo-btn {
          border-radius: 14px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid transparent;
          font-family: 'Outfit', sans-serif;
        }
        
        .neo-btn-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }
        
        .neo-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.35);
          filter: brightness(1.05);
        }
        
        .neo-btn-primary:active {
          transform: translateY(0);
        }

        .neo-btn-secondary {
          background: rgba(255, 255, 255, 0.9);
          color: #0f172a;
          border-color: #e2e8f0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
        }
        
        .neo-btn-secondary:hover {
          background: #fff;
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05);
        }

        /* Modal Animation */
        .modal-enter-active {
          animation: modalScaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes modalScaleUp {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .shake-element {
          animation: shake 0.3s ease-in-out;
        }

        @keyframes pulseWarning {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .pulse-warning {
          animation: pulseWarning 2s infinite;
        }

        /* Modern Filter Modal styles */
        .filter-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 6px;
        }

        .filter-pill {
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(241, 245, 249, 0.8);
          border: 1px solid rgba(226, 232, 240, 0.8);
          color: #475569;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          user-select: none;
        }

        .dark .filter-pill {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #94a3b8;
        }

        .filter-pill:hover {
          background: rgba(226, 232, 240, 0.9);
          transform: translateY(-1px);
        }

        .dark .filter-pill:hover {
          background: rgba(51, 65, 85, 0.5);
          color: #cbd5e1;
        }

        .filter-pill.active-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
          border-color: #3b82f6 !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
        }

        .filter-pill.active-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          border-color: #10b981 !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        }

        .filter-pill.active-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
          border-color: #ef4444 !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
        }

        .filter-pill.active-warning {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          border-color: #f59e0b !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
        }

        .modal-backdrop-blur {
          background: rgba(8, 10, 24, 0.6) !important;
          backdrop-filter: blur(12px) !important;
          animation: fadeInBackdrop 0.3s ease-out forwards;
        }

        @keyframes fadeInBackdrop {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(12px); }
        }

        .modal-enter-spring {
          animation: modalSpring 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes modalSpring {
          from { opacity: 0; transform: scale(0.92) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        
        /* Custom Table */
        .modern-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 12px;
        }
        
        .modern-table tr {
          border-radius: 16px;
          transition: all 0.3s;
        }
        
        .modern-table tbody tr {
          background: rgba(255, 255, 255, 0.8);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }
        
        .modern-table tbody tr:hover {
          transform: translateY(-3px) scale(1.005);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05);
          background: #fff;
        }
        
        .modern-table td, .modern-table th {
          padding: 10px 12px;
          vertical-align: middle;
          font-size: 13px;
        }
        
        .modern-table th {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94a3b8;
          padding-bottom: 6px;
        }
        
        .modern-table td:first-child, .modern-table th:first-child { border-top-left-radius: 16px; border-bottom-left-radius: 16px; }
        .modern-table td:last-child, .modern-table th:last-child { border-top-right-radius: 16px; border-bottom-right-radius: 16px; }

        /* Form Inputs */
        .form-input {
          background: rgba(248, 250, 252, 0.8);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #0f172a;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          font-family: inherit;
        }
        
        .form-input:focus {
          border-color: #3b82f6;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.03);
          outline: none;
        }
        
        .form-input::placeholder {
          color: #94a3b8;
        }

        /* Toggle Switch */
        .switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 26px;
        }
        
        .switch input { opacity: 0; width: 0; height: 0; }
        
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #e2e8f0;
          transition: .3s;
          border-radius: 24px;
        }
        
        .slider:before {
          position: absolute;
          content: "";
          height: 20px; width: 20px;
          left: 3px; bottom: 3px;
          background-color: white;
          transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        
        input:checked + .slider { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
        input:checked + .slider:before { transform: translateX(22px); }

        /* Tabs */
        .tab-btn {
          padding: 12px 20px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 13px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Outfit', sans-serif;
        }
        
        .tab-btn.active {
          background: #fff;
          color: #1d4ed8;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.04);
        }
        
        .tab-btn:not(.active) {
          color: #64748b;
        }
        
        .tab-btn:not(.active):hover {
          background: rgba(255, 255, 255, 0.5);
          color: #0f172a;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 20 }}>
        
        {/* HEADER SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)' }}>
              <Users size={28} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Gestão de Alunos</h1>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0, marginTop: 2 }}>Controle completo da secretaria escolar</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className="neo-btn" 
              style={{ padding: '12px 20px', fontSize: 14, background: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)' }}
            >
              <Info size={18} /> Ajuda e Regras
            </button>
            <button onClick={handleNovoAluno} className="neo-btn neo-btn-primary" style={{ padding: '12px 24px', fontSize: 14 }}>
              <Plus size={18} /> Novo Aluno
            </button>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                className="form-input" 
                style={{ paddingLeft: 40, height: 44, borderRadius: 12, border: '1px solid #e2e8f0', width: '100%', fontSize: 14 }} 
                placeholder="Buscar por nome, código ou CPF…" 
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <select 
                className="form-input" 
                style={{ height: 44, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 14, minWidth: 140 }}
                value={statusFiltro}
                onChange={e => setStatusFiltro(e.target.value)}
              >
                <option value="todos">Todos (Ativos)</option>
                <option value="todos_com_inativos">Todos (Com inativos)</option>
                <option value="ativo">Apenas Ativos</option>
                <option value="inativo">Apenas Inativos</option>
              </select>
              
              <button onClick={() => setIsFiltrosAvancadosModalOpen(true)} className="neo-btn neo-btn-secondary" style={{ padding: '0 16px', height: 44 }}>
                <Filter size={16} /> Filtros Avançados
              </button>
              
              <button onClick={() => setIsImportModalOpen(true)} className="neo-btn neo-btn-secondary" style={{ padding: '0 16px', height: 44 }}>
                <Upload size={16} /> Importar
              </button>
              
              <button onClick={() => setIsExportModalOpen(true)} className="neo-btn neo-btn-secondary" style={{ padding: '0 16px', height: 44 }}>
                <Download size={16} /> Exportar
              </button>
            </div>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="glass-card" style={{ padding: 20, overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('foto')} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Foto {sortField === 'foto' ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ID {sortField === 'id' ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th onClick={() => handleSort('nome')} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Nome Completo {sortField === 'nome' ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th onClick={() => handleSort('responsavel')} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Responsáveis {sortField === 'responsavel' ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th onClick={() => handleSort('turma')} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Turma {sortField === 'turma' ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th onClick={() => handleSort('autorizadoSairSozinho')} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Sair Sozinho {sortField === 'autorizadoSairSozinho' ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Status {sortField === 'status' ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={5} cols={8} />
              ) : alunosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Users size={32} style={{ color: '#94a3b8' }} />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>Nenhum aluno encontrado</span>
                    </div>
                  </td>
                </tr>
              ) : (
                alunosPaginados.map(aluno => (
                <tr key={aluno.id} style={{ background: !(aluno.status === 'Ativo' || aluno.status === 'matriculado') ? '#fee2e2' : undefined }}>
                  <td>
                    <div style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: '50%', 
                      background: aluno.foto ? `url(${aluno.foto}) center/cover no-repeat` : '#e2e8f0', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: 12, 
                      fontWeight: 700, 
                      color: '#64748b' 
                    }}>
                      {!aluno.foto && aluno.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: '#1e293b', fontSize: 12, whiteSpace: 'nowrap' }}>{aluno.matricula || aluno.codigo}</td>
                  <td style={{ maxWidth: 180, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, lineHeight: 1.2 }}>{aluno.nome}</span>
                      <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{aluno.email}</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: 220, whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 6, whiteSpace: 'nowrap' }}>
                      {aluno.responsaveis && aluno.responsaveis.length > 0 
                        ? aluno.responsaveis.map((r: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: '#475569', lineHeight: 1.1 }} title={r.nome}>{formatName(r.nome)}</span>
                              {r.parentesco && (
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  background: r.parentesco === 'pai' 
                                    ? 'rgba(59, 130, 246, 0.1)' 
                                    : r.parentesco === 'mae' 
                                      ? 'rgba(236, 72, 153, 0.1)' 
                                      : 'rgba(139, 92, 246, 0.1)',
                                  border: r.parentesco === 'pai' 
                                    ? '1px solid rgba(59, 130, 246, 0.2)' 
                                    : r.parentesco === 'mae' 
                                      ? '1px solid rgba(236, 72, 153, 0.2)' 
                                      : '1px solid rgba(139, 92, 246, 0.2)',
                                  color: r.parentesco === 'pai' 
                                    ? '#1d4ed8' 
                                    : r.parentesco === 'mae' 
                                      ? '#be185d' 
                                      : '#6d28d9'
                                }}>
                                  {r.parentesco}
                                </span>
                              )}
                            </div>
                          ))
                        : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: '#475569', lineHeight: 1.1 }} title={aluno.responsavel?.nome || (typeof aluno.responsavel === 'string' ? aluno.responsavel : 'Nenhum')}>
                                {formatName(aluno.responsavel?.nome || (typeof aluno.responsavel === 'string' ? aluno.responsavel : 'Nenhum'))}
                              </span>
                              {aluno.responsavel?.parentesco && (
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  background: aluno.responsavel.parentesco === 'pai' 
                                    ? 'rgba(59, 130, 246, 0.1)' 
                                    : aluno.responsavel.parentesco === 'mae' 
                                      ? 'rgba(236, 72, 153, 0.1)' 
                                      : 'rgba(139, 92, 246, 0.1)',
                                  border: aluno.responsavel.parentesco === 'pai' 
                                    ? '1px solid rgba(59, 130, 246, 0.2)' 
                                    : aluno.responsavel.parentesco === 'mae' 
                                      ? '1px solid rgba(236, 72, 153, 0.2)' 
                                      : '1px solid rgba(139, 92, 246, 0.2)',
                                  color: aluno.responsavel.parentesco === 'pai' 
                                    ? '#1d4ed8' 
                                    : aluno.responsavel.parentesco === 'mae' 
                                      ? '#be185d' 
                                      : '#6d28d9'
                                }}>
                                  {aluno.responsavel.parentesco}
                                </span>
                              )}
                            </div>
                          )
                      }
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, color: '#1d4ed8', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {aluno.turma_nome || todasTurmas.find((t: any) => String(t.id) === String(aluno.turma))?.nome || aluno.turma}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      fontSize: 10, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      background: aluno.autorizadoSairSozinho ? '#dcfce7' : '#fee2e2',
                      color: aluno.autorizadoSairSozinho ? '#166534' : '#991b1b'
                    }}>
                      {aluno.autorizadoSairSozinho ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      fontSize: 10, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      background: (aluno.status === 'Ativo' || aluno.status === 'matriculado') ? '#dcfce7' : '#fee2e2',
                      color: (aluno.status === 'Ativo' || aluno.status === 'matriculado') ? '#166534' : '#991b1b'
                    }}>
                      {aluno.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                      {/* Toggle Status */}
                      <button 
                        onClick={() => toggleStatus(aluno)} 
                        className="neo-btn neo-btn-secondary" 
                        style={{ padding: '6px 8px', borderRadius: '8px' }} 
                        title={(aluno.status === 'Ativo' || aluno.status === 'matriculado') ? 'Inativar' : 'Ativar'}
                      >
                        {(aluno.status === 'Ativo' || aluno.status === 'matriculado') ? <Shield size={13} color="#166534" /> : <Shield size={13} color="#94a3b8" />}
                      </button>
                      
                      {/* Toggle Sair Sozinho */}
                      <button 
                        onClick={() => toggleSairSozinho(aluno)} 
                        className="neo-btn neo-btn-secondary" 
                        style={{ padding: '6px 8px', borderRadius: '8px' }} 
                        title={aluno.autorizadoSairSozinho ? 'Revogar Saída' : 'Autorizar Saída'}
                      >
                        {aluno.autorizadoSairSozinho ? <DoorOpen size={13} color="#1d4ed8" /> : <DoorOpen size={13} color="#94a3b8" />}
                      </button>

                      <button onClick={() => handleEdit(aluno)} className="neo-btn neo-btn-secondary" style={{ padding: '6px 8px', borderRadius: '8px' }} title="Editar">
                        <Edit size={13} color="#3b82f6" />
                      </button>
                      
                      <button onClick={() => handleDelete(aluno.id)} className="neo-btn neo-btn-secondary" style={{ padding: '6px 8px', borderRadius: '8px' }} title="Excluir">
                        <Trash2 size={13} color="#dc2626" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>

          {/* PAGINATION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
              <span>Exibindo</span>
              {isFetching && (
                <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600 }}>• Atualizando...</span>
              )}
              <select 
                className="form-input" 
                style={{ height: 32, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 4px' }}
                value={itensPorPagina}
                onChange={e => { setItensPorPagina(Number(e.target.value)); setPaginaAtual(1); }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={999999}>Todos</option>
              </select>
              <span>de {total} alunos</span>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <button 
                className="neo-btn neo-btn-secondary" 
                style={{ padding: '0 12px', height: 32, fontSize: 13 }}
                onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                disabled={paginaAtual === 1}
              >
                Anterior
              </button>
              {getPaginasExibidas().map((pag, idx) => {
                if (pag === '...') {
                  return (
                    <span 
                      key={`dots-${idx}`} 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: 32, 
                        height: 32, 
                        color: '#94a3b8', 
                        fontWeight: 700 
                      }}
                    >
                      ...
                    </span>
                  )
                }
                return (
                  <button 
                    key={pag}
                    className={`neo-btn ${paginaAtual === pag ? 'neo-btn-primary' : 'neo-btn-secondary'}`}
                    style={{ width: 32, height: 32, padding: 0, justifyContent: 'center', fontSize: 13 }}
                    onClick={() => setPaginaAtual(Number(pag))}
                  >
                    {pag}
                  </button>
                )
              })}
              <button 
                className="neo-btn neo-btn-secondary" 
                style={{ padding: '0 12px', height: 32, fontSize: 13 }}
                onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaAtual === totalPaginas}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ULTRA MODERN ANIMATED MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div 
            className="glass-card ultra-modal modal-enter-active" 
            style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            
            {/* Modal Header */}
            <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={20} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Cadastrar Novo Aluno</h2>
                  <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>Preencha os dados para adicionar ao sistema</p>
                </div>
              </div>
              <button onClick={toggleModal} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ background: 'transparent', padding: '12px 32px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 8 }}>
              <button className={`tab-btn ${activeTab === 'aluno' ? 'active' : ''}`} onClick={() => setActiveTab('aluno')}>
                <Users size={14} /> Dados do Aluno
              </button>
              <button className={`tab-btn ${activeTab === 'responsavel' ? 'active' : ''}`} onClick={() => { setActiveTab('responsavel'); setMostrarFormResponsavel(true); }}>
                <Shield size={14} /> Responsáveis
              </button>
              <button className={`tab-btn ${activeTab === 'turma' ? 'active' : ''}`} onClick={() => setActiveTab('turma')}>
                <Tag size={14} /> Vínculo de Turma
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 32, overflowY: 'auto', flex: 1 }}>
              
              {/* TAB: DADOS DO ALUNO */}
              {activeTab === 'aluno' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Avatar Upload */}
                   <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div 
                      onClick={() => document.getElementById('foto-aluno-input')?.click()}
                      style={{ width: 80, height: 80, borderRadius: '20px', background: formData.aluno.foto ? `url(${formData.aluno.foto}) center/cover` : 'rgba(248, 250, 252, 0.8)', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3b82f6', transition: 'all 0.2s' }}
                    >
                      {!formData.aluno.foto && (
                        <>
                          <Camera size={24} />
                          <span style={{ fontSize: 10, marginTop: 4, fontWeight: 700 }}>Adicionar Foto</span>
                        </>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Foto do Aluno</p>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 8px 0' }}>PNG, JPG ou WEBP. Máx 2MB.</p>
                      <button onClick={() => document.getElementById('foto-aluno-input')?.click()} className="neo-btn neo-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                        <Upload size={12} /> Fazer Upload
                      </button>
                      <input 
                        id="foto-aluno-input" 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              alert('Arquivo muito grande! Máximo 10MB.');
                              return;
                            }
                            const reader = new FileReader()
                            reader.onloadend = () => {
                              const img = new Image();
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const MAX_WIDTH = 500;
                                const MAX_HEIGHT = 500;
                                let width = img.width;
                                let height = img.height;
                                
                                if (width > height) {
                                  if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                  }
                                } else {
                                  if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                  }
                                }
                                
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.drawImage(img, 0, 0, width, height);
                                  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                  handleInputChange('aluno', 'foto', dataUrl);
                                } else {
                                  handleInputChange('aluno', 'foto', reader.result);
                                }
                              };
                              img.src = reader.result as string;
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Form Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Linha 1 */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: '1' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>ID *</label>
                        <input 
                          className="form-input" 
                          style={{ borderColor: hasError('codigo') ? '#ef4444' : undefined, boxShadow: hasError('codigo') ? '0 0 0 1px #ef4444' : undefined }}
                          placeholder="Ex: AL001" 
                          value={formData.aluno.codigo || ''} 
                          onChange={e => {
                            handleInputChange('aluno', 'codigo', e.target.value);
                            if (hasError('codigo')) {
                              setValidationErrors(prev => prev.filter(err => err.field !== 'codigo'));
                            }
                          }} 
                        />
                      </div>
                      <div style={{ flex: '3' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Nome Completo *</label>
                        <input 
                          className="form-input" 
                          style={{ borderColor: hasError('nome') ? '#ef4444' : undefined, boxShadow: hasError('nome') ? '0 0 0 1px #ef4444' : undefined }}
                          placeholder="Nome do aluno" 
                          value={formData.aluno.nome || ''} 
                          onChange={e => {
                            handleInputChange('aluno', 'nome', e.target.value);
                            if (hasError('nome')) {
                              setValidationErrors(prev => prev.filter(err => err.field !== 'nome'));
                            }
                          }} 
                        />
                      </div>
                    </div>

                    {/* Linha 2 */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: '1' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Data de Nascimento *</label>
                        <input 
                          type="date" 
                          className="form-input" 
                          style={{ borderColor: hasError('dataNasc') ? '#ef4444' : undefined, boxShadow: hasError('dataNasc') ? '0 0 0 1px #ef4444' : undefined }}
                          value={formData.aluno.dataNasc || ''} 
                          onChange={e => {
                            handleInputChange('aluno', 'dataNasc', e.target.value);
                            if (hasError('dataNasc')) {
                              setValidationErrors(prev => prev.filter(err => err.field !== 'dataNasc'));
                            }
                          }} 
                        />
                      </div>
                      <div style={{ flex: '1' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Telefone</label>
                        <input className="form-input" placeholder="(00) 00000-0000" value={formData.aluno.telefone || ''} onChange={e => handleInputChange('aluno', 'telefone', e.target.value)} />
                      </div>
                      <div style={{ flex: '2' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>E-mail</label>
                        <input type="email" className="form-input" placeholder="email@exemplo.com" value={formData.aluno.email || ''} onChange={e => handleInputChange('aluno', 'email', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div style={{ display: 'flex', gap: 40, background: 'rgba(248, 250, 252, 0.6)', padding: '16px 20px', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label className="switch">
                        <input type="checkbox" checked={formData.aluno.ativo} onChange={e => handleInputChange('aluno', 'ativo', e.target.checked)} />
                        <span className="slider"></span>
                      </label>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>Aluno Ativo</p>
                        <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Habilitado no sistema</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label className="switch">
                        <input type="checkbox" checked={formData.aluno.autorizadoSairSozinho} onChange={e => handleInputChange('aluno', 'autorizadoSairSozinho', e.target.checked)} />
                        <span className="slider"></span>
                      </label>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>Autorizado a Sair Sozinho</p>
                        <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Dispensa acompanhamento</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: RESPONSÁVEIS */}
              {activeTab === 'responsavel' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Search Existing */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px] max-w-[400px] relative">
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Buscar Responsável Existente</label>
                      <div style={{ position: 'relative' }}>
                        <SearchIcon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                          className="form-input" 
                          style={{ paddingLeft: 36, height: 44 }} 
                          placeholder="Nome ou CPF do responsável…" 
                          value={buscaResponsavel}
                          onChange={e => setBuscaResponsavel(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleBuscarResponsavel()}
                        />
                      </div>
                      
                      {/* Resultados da busca */}
                      {resultadosResponsaveis.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                          {resultadosResponsaveis.map(resp => (
                            <div 
                              key={resp.id} 
                              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                              onClick={() => {
                                const mappedResp = {
                                  id: resp.id || '',
                                  nome: resp.nome || '',
                                  dataNasc: resp.data_nasc || resp.dataNasc || '',
                                  email: resp.email || '',
                                  telefone: resp.telefone || '',
                                  profissao: resp.profissao || '',
                                  codigo: resp.codigo || resp.id || '',
                                  codigoAluno: resp.codigoAluno || '',
                                  rfid: resp.rfid || '',
                                  parentesco: resp.parentesco || '',
                                  diasAcesso: resp.dias_acesso || resp.diasAcesso || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
                                  isFinanceiro: resp.isFinanceiro || resp.alunosVinculados?.some((a: any) => a.isFinanceiro) || false,
                                  isPedagogico: resp.isPedagogico || resp.alunosVinculados?.some((a: any) => a.isPedagogico) || false,
                                  isOutro: resp.isOutro || resp.alunosVinculados?.some((a: any) => a.isOutro) || false,
                                  proibido: resp.proibido === true
                                }
                                setFormData({
                                  ...formData,
                                  responsaveis: [...formData.responsaveis.filter(r => r.id), mappedResp] // Adiciona aos responsáveis
                                })
                                setResultadosResponsaveis([])
                                setBuscaResponsavel('')
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                            >
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{resp.nome}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{resp.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={handleBuscarResponsavel} 
                      className="neo-btn neo-btn-secondary shrink-0" 
                      style={{ height: 44, padding: '0 24px', minWidth: '100px', fontSize: 14 }}
                      disabled={loadingBuscaResp}
                    >
                      {loadingBuscaResp ? 'Buscando...' : 'Buscar'}
                    </button>
                    <div style={{ fontSize: 13, color: '#64748b', alignSelf: 'center', padding: '0 4px', paddingBottom: 12 }}>ou</div>
                    <button onClick={() => {
                      const randCode = Math.floor(1000000 + Math.random() * 9000000).toString();
                      setFormData({ ...formData, responsaveis: [...formData.responsaveis, { id: randCode, nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: randCode, codigoAluno: '', rfid: '', parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false, isNewAdded: true } as any] });
                      setMostrarFormResponsavel(true);
                    }} className="neo-btn neo-btn-primary shrink-0" style={{ height: 44, padding: '0 24px', fontSize: 14 }}>
                      <Plus size={16} /> Novo Responsável
                    </button>
                  </div>

                  {mostrarFormResponsavel && (
                    <>
                      <div style={{ height: '1px', background: '#e2e8f0' }} />
                      
                      {formData.responsaveis.map((resp, index) => (
                        <div key={index} style={{ border: hasError(`resp_${index}_tipo`) || hasError(`resp_${index}_id`) || hasError(`resp_${index}_nome`) || hasError(`resp_${index}_parentesco`) ? '1px solid #ef4444' : '1px solid #e2e8f0', padding: 16, borderRadius: 12, marginBottom: 16, background: 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Responsável #{index + 1} *</h3>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formData.responsaveis.filter((_, i) => i !== index);
                                  setFormData({ ...formData, responsaveis: updated });
                                  if (updated.length === 0) setMostrarFormResponsavel(false);
                                  setValidationErrors(prev => prev.filter(err => !err.field.startsWith(`resp_${index}_`)));
                                }}
                                style={{
                                  padding: '4px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Remover responsável"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const val = !resp.isFinanceiro;
                                  handleInputChange('responsaveis', 'isFinanceiro', val, index);
                                  if (val || resp.isPedagogico || resp.isOutro) {
                                    setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_tipo`));
                                  }
                                }}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  border: '1px solid',
                                  borderColor: resp.isFinanceiro ? '#10b981' : hasError(`resp_${index}_tipo`) ? '#ef4444' : '#e2e8f0',
                                  background: resp.isFinanceiro ? '#10b981' : '#fff',
                                  color: resp.isFinanceiro ? '#fff' : '#64748b',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Financeiro
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const val = !resp.isPedagogico;
                                  handleInputChange('responsaveis', 'isPedagogico', val, index);
                                  if (val || resp.isFinanceiro || resp.isOutro) {
                                    setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_tipo`));
                                  }
                                }}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  border: '1px solid',
                                  borderColor: resp.isPedagogico ? '#8b5cf6' : hasError(`resp_${index}_tipo`) ? '#ef4444' : '#e2e8f0',
                                  background: resp.isPedagogico ? '#8b5cf6' : '#fff',
                                  color: resp.isPedagogico ? '#fff' : '#64748b',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Pedagógico
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const val = !resp.isOutro;
                                  handleInputChange('responsaveis', 'isOutro', val, index);
                                  if (val || resp.isFinanceiro || resp.isPedagogico) {
                                    setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_tipo`));
                                  }
                                }}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  border: '1px solid',
                                  borderColor: resp.isOutro ? '#f59e0b' : hasError(`resp_${index}_tipo`) ? '#ef4444' : '#e2e8f0',
                                  background: resp.isOutro ? '#f59e0b' : '#fff',
                                  color: resp.isOutro ? '#fff' : '#64748b',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Outro
                              </button>
                            </div>
                          </div>

                          {/* Dynamic Badges on Top of Card */}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                            {resp.isFinanceiro && (
                              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Check size={10} /> Financeiro
                              </span>
                            )}
                            {resp.isPedagogico && (
                              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Check size={10} /> Pedagógico
                              </span>
                            )}
                            {resp.isOutro && (
                              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Check size={10} /> Outro
                              </span>
                            )}
                            {!resp.isFinanceiro && !resp.isPedagogico && !resp.isOutro && resp.parentesco !== 'outro' && (
                              <span className="pulse-warning" style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: '#fee2e2', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={10} /> Tipo Obrigatório *
                              </span>
                            )}
                          </div>
                          
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Linha 1 */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: '1', maxWidth: '100px' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>ID *</label>
                        <input 
                          className="form-input" 
                          style={{ borderColor: hasError(`resp_${index}_id`) ? '#ef4444' : undefined, boxShadow: hasError(`resp_${index}_id`) ? '0 0 0 1px #ef4444' : undefined }}
                          placeholder="Ex: RESP001" 
                          value={resp.id || resp.codigo || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            handleInputChange('responsaveis', 'id', val, index);
                            handleInputChange('responsaveis', 'codigo', val, index);
                            if (hasError(`resp_${index}_id`)) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_id`));
                            }
                          }} 
                        />
                      </div>
                      <div style={{ flex: '3.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Nome Completo *</label>
                        <input 
                          className="form-input" 
                          style={{ borderColor: hasError(`resp_${index}_nome`) ? '#ef4444' : undefined, boxShadow: hasError(`resp_${index}_nome`) ? '0 0 0 1px #ef4444' : undefined }}
                          placeholder="Nome do responsável" 
                          value={resp.nome || ''} 
                          onChange={e => {
                            handleInputChange('responsaveis', 'nome', e.target.value, index);
                            if (hasError(`resp_${index}_nome`)) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_nome`));
                            }
                          }} 
                        />
                      </div>
                      <div style={{ flex: '1.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Parentesco *</label>
                        <select 
                          className="form-input" 
                          style={{ borderColor: hasError(`resp_${index}_parentesco`) ? '#ef4444' : undefined, boxShadow: hasError(`resp_${index}_parentesco`) ? '0 0 0 1px #ef4444' : undefined }}
                          value={resp.parentesco || ''} 
                          onChange={e => {
                            handleInputChange('responsaveis', 'parentesco', e.target.value, index);
                            if (hasError(`resp_${index}_parentesco`)) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_parentesco`));
                            }
                          }}
                        >
                          <option value="">Selecione…</option>
                          <option value="pai">Pai</option>
                          <option value="mae">Mãe</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                    </div>

                    {/* Linha 2 */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: '1.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Data de Nascimento</label>
                        <input type="date" className="form-input" value={resp.dataNasc || ''} onChange={e => handleInputChange('responsaveis', 'dataNasc', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '2.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>E-mail</label>
                        <input type="email" className="form-input" placeholder="email@exemplo.com" value={resp.email || ''} onChange={e => handleInputChange('responsaveis', 'email', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '1.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Telefone</label>
                        <input className="form-input" placeholder="(00) 00000-0000" value={resp.telefone || ''} onChange={e => handleInputChange('responsaveis', 'telefone', e.target.value, index)} />
                      </div>
                    </div>

                    {/* Linha 3 */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: '2' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Profissão</label>
                        <input className="form-input" placeholder="Ex: Professor" value={resp.profissao || ''} onChange={e => handleInputChange('responsaveis', 'profissao', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '2' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Cartão RFID</label>
                        <div style={{ position: 'relative' }}>
                          <CreditCard size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Aproxime o cartão…" value={resp.rfid || ''} onChange={e => handleInputChange('responsaveis', 'rfid', e.target.value, index)} />
                        </div>
                      </div>
                      <div style={{ flex: '1.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Vínculo</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', fontSize: 13, fontWeight: 700, color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Tag size={12} /> {formData.aluno.codigo || 'Novo Aluno'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                          {/* Dias de Acesso */}
                          <div style={{ marginTop: 16 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Dias Permitidos para Retirada (RFID)</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(dia => {
                                const isSelected = resp.diasAcesso?.includes(dia);
                                const showAsSelected = isSelected && !resp.proibido;
                                return (
                                  <button
                                    key={dia}
                                    type="button"
                                    onClick={() => {
                                      if (resp.proibido) return;
                                      const currentDias = resp.diasAcesso || [];
                                      const newDias = isSelected
                                        ? currentDias.filter((d: string) => d !== dia)
                                        : [...currentDias, dia];
                                      handleInputChange('responsaveis', 'diasAcesso', newDias, index);
                                    }}
                                    style={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: '50%',
                                      border: '1px solid',
                                      borderColor: showAsSelected ? '#10b981' : '#ef4444',
                                      background: showAsSelected ? '#10b981' : '#fff',
                                      color: showAsSelected ? '#fff' : '#ef4444',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: resp.proibido ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s',
                                      boxShadow: showAsSelected ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
                                      opacity: resp.proibido ? 0.7 : 1
                                    }}
                                  >
                                    {dia.substring(0, 1)}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => handleInputChange('responsaveis', 'proibido', !resp.proibido, index)}
                                style={{
                                  height: 40,
                                  padding: '0 16px',
                                  borderRadius: '20px',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  border: '1px solid',
                                  borderColor: resp.proibido ? '#ef4444' : '#10b981',
                                  background: resp.proibido ? '#ef4444' : '#10b981',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginLeft: 'auto'
                                }}
                              >
                                {resp.proibido ? 'Proibido' : 'Liberado'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button 
                        onClick={() => {
                          const randCode = Math.floor(1000000 + Math.random() * 9000000).toString();
                          setFormData({ ...formData, responsaveis: [...formData.responsaveis, { id: randCode, nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: randCode, codigoAluno: '', rfid: '', parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false }] })
                        }} 
                        className="neo-btn" 
                        style={{ 
                          width: '100%', 
                          padding: '16px', 
                          borderRadius: '12px', 
                          border: '2px dashed #3b82f6', 
                          background: 'rgba(59, 130, 246, 0.05)', 
                          color: '#1d4ed8', 
                          fontWeight: 700, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: 8,
                          marginTop: 16,
                          transition: 'all 0.2s'
                        }}
                      >
                        <Plus size={18} /> Adicionar Outro Responsável
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* TAB: TURMA (HISTÓRICO) */}
              {activeTab === 'turma' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>Histórico de Turmas</h3>
                      <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>Gerencie os vínculos do aluno com turmas e anos letivos.</p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        const novoHist = [...formData.historicoTurmas, { id: `HIST-${Date.now()}`, anoLetivo: '', segmento: '', serieTurma: '' }];
                        setFormData(prev => ({ ...prev, historicoTurmas: novoHist }));
                      }}
                      style={{ background: '#f8fafc', color: '#3b82f6', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Plus size={16} /> Adicionar Vínculo
                    </button>
                  </div>
                  
                  {hasError('historico_empty') && (
                    <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                      É necessário adicionar pelo menos um vínculo de turma.
                    </div>
                  )}



                  {(() => {
                    const sortedIndices = formData.historicoTurmas
                      .map((_, originalIndex) => originalIndex)
                      .reverse();

                    return sortedIndices.map((originalIndex, sortedPos) => {
                      const hist = formData.historicoTurmas[originalIndex];
                      const index = originalIndex;
                      const isActive = sortedPos === 0;
                      const badgeBg = isActive ? '#dcfce7' : '#fef08a';
                      const badgeColor = isActive ? '#166534' : '#854d0e';
                      const badgeText = isActive ? 'Matriculado (Cursando)' : 'Histórico (Anterior)';
                      
                      return (
                        <div key={hist.id || index} style={{ background: '#f8fafc', border: `1px solid ${isActive ? '#86efac' : '#e2e8f0'}`, borderRadius: 12, padding: 16, position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                const newHist = formData.historicoTurmas.filter((_, i) => i !== index);
                                setFormData(prev => ({ ...prev, historicoTurmas: newHist }));
                              }}
                              style={{ background: 'white', color: '#ef4444', border: '1px solid #fee2e2', padding: 6, borderRadius: 6, cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: 0 }}>Vínculo #{sortedPos + 1}</h4>
                            <span style={{ background: badgeBg, color: badgeColor, fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                              {badgeText}
                            </span>
                          </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Ano Letivo *</label>
                          <select 
                            className="form-input" 
                            style={{ borderColor: hasError(`hist_${index}_anoLetivo`) ? '#ef4444' : undefined, boxShadow: hasError(`hist_${index}_anoLetivo`) ? '0 0 0 1px #ef4444' : undefined }}
                            value={hist.anoLetivo} 
                            onChange={e => {
                              const newHist = [...formData.historicoTurmas];
                              newHist[index].anoLetivo = e.target.value;
                              setFormData(prev => ({ ...prev, historicoTurmas: newHist }));
                              if (hasError(`hist_${index}_anoLetivo`)) setValidationErrors(prev => prev.filter(err => err.field !== `hist_${index}_anoLetivo`));
                            }}
                          >
                            <option value="">Selecione o ano...</option>
                            {cfgCalendarioLetivo?.map((c: any) => (
                              <option key={c.id} value={c.ano}>{c.ano}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Segmento</label>
                          <select 
                            className="form-input" 
                            value={hist.segmento} 
                            onChange={e => {
                              const newHist = [...formData.historicoTurmas];
                              newHist[index].segmento = e.target.value;
                              newHist[index].serieTurma = ''; // Reset turma ao mudar segmento
                              setFormData(prev => ({ ...prev, historicoTurmas: newHist }));
                            }}
                          >
                            <option value="">Selecione o segmento...</option>
                            {cfgNiveisEnsino?.map((n: any) => (
                              <option key={n.id} value={n.nome}>{n.nome}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Série / Turma *</label>
                          <select 
                            className="form-input" 
                            style={{ borderColor: hasError(`hist_${index}_serieTurma`) ? '#ef4444' : undefined, boxShadow: hasError(`hist_${index}_serieTurma`) ? '0 0 0 1px #ef4444' : undefined }}
                            value={hist.serieTurma} 
                            onChange={e => {
                              const newHist = [...formData.historicoTurmas];
                              newHist[index].serieTurma = e.target.value;
                              setFormData(prev => ({ ...prev, historicoTurmas: newHist }));
                              if (hasError(`hist_${index}_serieTurma`)) setValidationErrors(prev => prev.filter(err => err.field !== `hist_${index}_serieTurma`));
                            }}
                            disabled={!hist.segmento}
                          >
                            <option value="">Selecione a turma...</option>
                            {todasTurmas
                              .filter((t: any) => t.dados?.segmento === hist.segmento)
                              .map((t: any) => (
                                <option key={t.id} value={t.id}>{t.nome} ({t.serie})</option>
                              ))}
                          </select>
                        </div>

                      </div>
                    </div>
                  );
                });
              })()}
                  
                  <div style={{ background: 'rgba(59,130,246,0.05)', padding: '16px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>Dica de Secretário</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>O último vínculo adicionado será considerado como a turma atual (Matriculado) do aluno para acesso às agendas e catracas do ano vigente.</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px 32px', borderTop: '1px solid rgba(0,0,0,0.05)', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeTab === 'aluno' ? '#1d4ed8' : '#e2e8f0' }}></span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeTab === 'responsavel' ? '#1d4ed8' : '#e2e8f0' }}></span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeTab === 'turma' ? '#1d4ed8' : '#e2e8f0' }}></span>
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={toggleModal} className="neo-btn neo-btn-secondary" style={{ padding: '10px 20px', fontSize: 13 }}>
                  Cancelar
                </button>
                {activeTab !== 'turma' ? (
                  <button 
                    className="neo-btn neo-btn-primary" 
                    style={{ padding: '10px 20px', fontSize: 13 }}
                    onClick={() => {
                      const nextTab = activeTab === 'aluno' ? 'responsavel' : 'turma';
                      setActiveTab(nextTab);
                      if (nextTab === 'responsavel') setMostrarFormResponsavel(true);
                    }}
                  >
                    Próximo Passo
                  </button>
                ) : (
                  <button onClick={handleSave} className="neo-btn neo-btn-primary" style={{ padding: '10px 24px', fontSize: 13, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
                    <Check size={16} /> Finalizar Cadastro
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {isImportModalOpen && (
        <ImportarAlunosModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          onSuccess={() => {
            console.log('Importação de alunos concluída com sucesso. Atualizando cache...');
            queryClient.invalidateQueries({ queryKey: ['alunos'] });
          }} 
        />
      )}

      {isValidationModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div 
            className="glass-card ultra-modal modal-enter-active shake-element" 
            style={{ width: '100%', maxWidth: 500, padding: 32, textAlign: 'center', position: 'relative', boxShadow: '0 30px 60px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button 
              onClick={() => setIsValidationModalOpen(false)} 
              style={{ position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#0f172a' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#64748b' }}
            >
              <X size={16} />
            </button>

            <div className="pulse-warning" style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1.5px dashed rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <AlertTriangle size={28} color="#ef4444" />
            </div>

            <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>Campos Obrigatórios Pendentes</h3>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: '1.6', margin: '0 0 24px' }}>
              Por favor, preencha todos os dados obrigatórios listados abaixo para concluir o cadastro.
            </p>

            <div style={{ textAlign: 'left', maxHeight: 240, overflowY: 'auto', background: 'rgba(248, 250, 252, 0.8)', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {/* Group errors by category */}
              {['aluno', 'responsavel', 'turma'].map(catTab => {
                const catErrors = validationErrors.filter(e => e.tab === catTab);
                if (catErrors.length === 0) return null;
                const tabLabel = catErrors[0].tabLabel;
                return (
                  <div key={catTab} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {catTab === 'aluno' && <Users size={12} />}
                      {catTab === 'responsavel' && <Shield size={12} />}
                      {catTab === 'turma' && <Tag size={12} />}
                      {tabLabel}
                    </div>
                    {catErrors.map((err, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                          setActiveTab(err.tab);
                          if (err.tab === 'responsavel') setMostrarFormResponsavel(true);
                          setIsValidationModalOpen(false);
                        }}
                        style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
                        <span>{err.label}</span>
                        <span style={{ fontSize: 10, color: '#3b82f6', marginLeft: 'auto', fontWeight: 600 }}>Corrigir →</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setIsValidationModalOpen(false)}
              className="neo-btn neo-btn-primary"
              style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {deleteModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div 
            className={`glass-card ultra-modal modal-enter-active ${deleteModal.wrongPasswordError ? 'shake-element' : ''}`} 
            style={{ width: '100%', maxWidth: 440, padding: 32, textAlign: 'center', position: 'relative', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {deleteModal.step === 'password' && (
              <>
                <button 
                  onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))} 
                  style={{ position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8' }}
                >
                  <X size={16} />
                </button>

                <div className="pulse-warning" style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1.5px dashed rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Trash2 size={28} color="#ef4444" />
                </div>

                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>Excluir Todos os Alunos</h3>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: '1.6', margin: '0 0 24px' }}>
                  Esta ação é irreversível e excluirá permanentemente todos os alunos cadastrados, seus históricos, frequências e vínculos do banco de dados.
                  Para confirmar, digite <b>CONFIRMAR</b> abaixo:
                </p>

                <form onSubmit={handleConfirmDeleteAllPassword}>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#64748b" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder="Digite CONFIRMAR"
                      value={deleteModal.passwordValue}
                      onChange={(e) => setDeleteModal(prev => ({ ...prev, passwordValue: e.target.value }))}
                      style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: 12, border: deleteModal.wrongPasswordError ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.2)', color: '#fff', fontSize: 14, outline: 'none', transition: 'all 0.2s' }}
                      autoFocus
                    />
                  </div>
                  {deleteModal.wrongPasswordError && (
                    <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, margin: '8px 0 0', textAlign: 'left' }}>Palavra incorreta! Digite CONFIRMAR em maiúsculo.</p>
                  )}
                  
                  <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button
                      type="button"
                      onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))}
                      className="neo-btn neo-btn-secondary"
                      style={{ flex: 1, padding: '12px 0', fontSize: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="neo-btn"
                      style={{ flex: 1, padding: '12px 0', fontSize: 14, borderRadius: 12, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', boxShadow: '0 8px 20px rgba(220,38,38,0.2)', cursor: 'pointer' }}
                    >
                      Confirmar Exclusão
                    </button>
                  </div>
                </form>
              </>
            )}

            {deleteModal.step === 'deleting' && (
              <>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', margin: '0 0 4px', fontFamily: 'Outfit, sans-serif' }}>Excluindo Registros</h3>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>Removendo alunos do banco de dados em lote com segurança...</p>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '30px auto', width: 140, height: 140 }}>
                  <svg width="140" height="140" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.3))' }}>
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="rgba(255, 255, 255, 0.04)"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="url(#progressGradient)"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={(2 * Math.PI * 50) - (deleteModal.progress / 100) * (2 * Math.PI * 50)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.08s linear' }}
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: '#f43f5e', fontFamily: 'Outfit, sans-serif' }}>
                      {deleteModal.progress}%
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                      EXCLUINDO
                    </span>
                  </div>
                </div>
              </>
            )}

            {deleteModal.step === 'success' && (
              <>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', border: '2px solid rgba(34, 197, 94, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'modalScaleUp 0.5s ease-out' }}>
                  <CheckCircle2 size={32} color="#22c55e" />
                </div>

                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>Exclusão Concluída</h3>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: '1.6', margin: '0 0 24px' }}>
                  Todos os <strong>{deleteModal.count}</strong> alunos foram permanentemente e com sucesso desvinculados e excluídos do ERP.
                </p>

                <button
                  onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))}
                  className="neo-btn neo-btn-primary"
                  style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                >
                  Concluir
                </button>
              </>
            )}

            {deleteModal.step === 'error' && (
              <>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <AlertTriangle size={32} color="#ef4444" />
                </div>

                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>Erro na Operação</h3>
                <p style={{ fontSize: 13, color: '#ef4444', lineHeight: '1.6', margin: '0 0 24px' }}>
                  Não foi possível completar a exclusão dos alunos: <br />
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{deleteModal.errorMsg}</span>
                </p>

                <button
                  onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))}
                  className="neo-btn neo-btn-secondary"
                  style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE AJUDA */}
      {isHelpModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setIsHelpModalOpen(false)} />
          <div className="glass-card" style={{ position: 'relative', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: 32, borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'modalScaleUp 0.3s ease-out' }}>
            
            <button onClick={() => setIsHelpModalOpen(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.05)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Info size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Ajuda e Regras de Cadastro</h2>
                <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Guia rápido para adicionar alunos e responsáveis manualmente</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* PASSO A PASSO */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#3b82f6', color: 'white', fontSize: 12 }}>1</span>
                  Passo a Passo
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '12px 16px', borderRadius: '0 8px 8px 0', color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                    <strong style={{ color: '#f8fafc' }}>1. Dados do Aluno:</strong> Clique em "Novo Aluno" e preencha os dados da criança. <br/>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>Campos obrigatórios: Nome Completo (o ID numérico deve ser igual ao "Código" do aluno no sistema MHUND/SAE. Se deixar em branco, o sistema sugerirá um).</span>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '12px 16px', borderRadius: '0 8px 8px 0', color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                    <strong style={{ color: '#f8fafc' }}>2. Buscar Responsável Existente:</strong> No passo de responsáveis, digite o nome ou ID no campo principal. Se a pessoa já estiver cadastrada, os dados dela serão preenchidos automaticamente. <br/>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>Nota: O ID do responsável deve ser igual ao "Código" do respectivo responsável no sistema MHUND/SAE.</span>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '12px 16px', borderRadius: '0 8px 8px 0', color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                    <strong style={{ color: '#f8fafc' }}>3. Cadastrar Novo Responsável:</strong> Se a pessoa não existir no sistema, preencha os dados. <br/>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>Campos obrigatórios: ID (numérico, único e igual ao "Código" no MHUND/SAE), Nome Completo, Parentesco e no mínimo 1 Tipo de Responsável.</span>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '12px 16px', borderRadius: '0 8px 8px 0', color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                    <strong style={{ color: '#f8fafc' }}>4. Finalizar:</strong> Clique em "Próximo Passo", escolha a turma do aluno (opcional) e clique em "Finalizar Cadastro".
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }}></div>

              {/* REGRAS IMPORTANTES */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} color="#f59e0b" /> Regras Importantes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 16 }}>
                    <h4 style={{ color: '#f8fafc', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} color="#8b5cf6"/> Pais e Mães</h4>
                    <p style={{ color: '#cbd5e1', fontSize: 14, margin: 0, lineHeight: 1.5 }}>Ao selecionar o parentesco <strong>Pai</strong> ou <strong>Mãe</strong>, o sistema exige que ele seja classificado. Ele deve ser obrigatoriamente <strong>Pedagógico</strong> ou <strong>Financeiro</strong> (ou ambos). Se já for Financeiro, não é obrigado a ser Pedagógico.</p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 16 }}>
                    <h4 style={{ color: '#f8fafc', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={16} color="#10b981"/> Outros Vínculos</h4>
                    <p style={{ color: '#cbd5e1', fontSize: 14, margin: 0, lineHeight: 1.5 }}>Para responsáveis com parentesco <strong>Outro</strong> (Tio, Avó, etc), não é necessário marcar Pedagógico nem Financeiro. O sistema marca a tag "Outro" automaticamente.</p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 16 }}>
                    <h4 style={{ color: '#f8fafc', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} color="#3b82f6"/> Múltiplos Responsáveis</h4>
                    <p style={{ color: '#cbd5e1', fontSize: 14, margin: 0, lineHeight: 1.5 }}>Um aluno pode ter vários responsáveis vinculados. Clique em "Adicionar Outro Responsável" no final do formulário para inserir mais de um.</p>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setIsHelpModalOpen(false)} className="neo-btn neo-btn-primary" style={{ width: '100%', marginTop: 24, padding: '14px 0', fontSize: 15 }}>
              Entendi, fechar ajuda
            </button>
          </div>
        </div>
      )}

      {/* FILTROS AVANÇADOS MODAL (EXACT SPEC REWRITE) */}
      {isFiltrosAvancadosModalOpen && (
        <div className="fixed inset-0 z-[10000]" style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-filtros-avancados">
            {/* Header */}
            <div className="modalHeader-fa">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[12px] bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Filter size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-slate-900 leading-tight">Filtros Avançados</h3>
                  <p className="text-[13px] text-slate-500 mt-0.5">Refine sua busca de alunos</p>
                </div>
              </div>
              <button onClick={() => setIsFiltrosAvancadosModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Body */}
            <div className="modalBody-fa">
              {/* Período de Cadastro (Ocupa 1 coluna) */}
              <div className="filterCard-fa">
                <h4 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 mb-4">
                  <Calendar size={16} className="text-blue-500" /> Período de Cadastro
                </h4>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">A Partir De</label>
                    <input 
                      type="date" 
                      className="w-full min-h-[44px] px-3 rounded-[12px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-[14px] font-medium outline-none transition-all"
                      value={filtrosAvancados.dataCadastroInicio}
                      onChange={e => setFiltrosAvancados(prev => ({ ...prev, dataCadastroInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Até</label>
                    <input 
                      type="date" 
                      className="w-full min-h-[44px] px-3 rounded-[12px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-[14px] font-medium outline-none transition-all"
                      value={filtrosAvancados.dataCadastroFim}
                      onChange={e => setFiltrosAvancados(prev => ({ ...prev, dataCadastroFim: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Turno de Estudo (Ocupa 1 coluna) */}
              <div className="filterCard-fa">
                <h4 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 mb-4">
                  <GraduationCap size={16} className="text-indigo-500" /> Turno de Estudo
                </h4>
                <div className="optionGroup-fa">
                  {[
                    { val: 'todos', label: 'Todos os turnos' },
                    { val: 'matutino', label: 'Matutino' },
                    { val: 'vespertino', label: 'Vespertino' },
                    { val: 'integral', label: 'Integral' },
                    { val: 'noturno', label: 'Noturno' },
                  ].map(item => {
                    const isActive = filtrosAvancados.turno === item.val;
                    return (
                      <button
                        key={item.val}
                        onClick={() => setFiltrosAvancados(prev => ({ ...prev, turno: item.val }))}
                        className={`optionButton-fa ${isActive ? 'active' : ''}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Saída na Portaria (Ocupa largura total - Full Width) */}
              <div className="filterCard-fa filterCardFull-fa">
                <h4 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 mb-4">
                  <DoorOpen size={16} className="text-emerald-500" /> Saída na Portaria
                </h4>
                <div className="optionGroup-fa">
                  {[
                    { val: 'todos', label: 'Qualquer' },
                    { val: 'true', label: 'Autorizado (Sozinho)' },
                    { val: 'false', label: 'Apenas com Responsável' },
                  ].map(item => {
                    const isActive = filtrosAvancados.autorizadoSairSozinho === item.val;
                    return (
                      <button
                        key={item.val}
                        onClick={() => setFiltrosAvancados(prev => ({ ...prev, autorizadoSairSozinho: item.val }))}
                        className={`optionButton-fa ${isActive ? 'active' : ''}`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modalFooter-fa">
              <button 
                onClick={() => setFiltrosAvancados({
                  dataCadastroInicio: '', dataCadastroFim: '', inadimplente: 'todos', riscoEvasao: 'todos', turno: 'todos', autorizadoSairSozinho: 'todos'
                })}
                className="flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-[12px] text-[14px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition-colors"
              >
                Limpar Filtros
              </button>
              <div className="flex gap-3 footer-actions-fa">
                <button 
                  onClick={() => setIsFiltrosAvancadosModalOpen(false)} 
                  className="min-h-[44px] px-6 rounded-[12px] font-bold text-[14px] text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => setIsFiltrosAvancadosModalOpen(false)}
                  className="min-h-[44px] px-8 rounded-[12px] font-bold text-[14px] bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Check size={18} strokeWidth={2.5} />
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            .modal-filtros-avancados {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: min(860px, calc(100vw - 40px));
              max-height: 88vh;
              height: auto;
              overflow: hidden;
              border-radius: 22px;
              background: #f8fafc;
              display: flex;
              flex-direction: column;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              border: 1px solid rgba(226, 232, 240, 0.8);
            }

            .modalHeader-fa {
              padding: 20px 24px 14px;
              background: #ffffff;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-shrink: 0;
            }

            .modalBody-fa {
              padding: 20px 24px;
              overflow-y: auto;
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 18px;
            }

            .filterCard-fa {
              padding: 18px;
              border-radius: 18px;
              height: auto;
              min-height: auto;
              background: #ffffff;
              border: 1px solid rgba(226, 232, 240, 0.8);
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
            }

            .filterCardFull-fa {
              grid-column: 1 / -1;
            }

            .optionGroup-fa {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }

            .optionButton-fa {
              min-height: 40px;
              padding: 0 16px;
              white-space: nowrap;
              width: auto;
              flex: 0 0 auto;
              border-radius: 10px;
              font-weight: 600;
              font-size: 13.5px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px solid #e2e8f0;
              background: #f8fafc;
              color: #475569;
              cursor: pointer;
              transition: all 0.2s;
            }
            .optionButton-fa:hover {
              background: #f1f5f9;
              border-color: #cbd5e1;
            }
            .optionButton-fa.active {
              background: #ffffff;
              color: #0f172a;
              border-color: #cbd5e1;
              box-shadow: 0 2px 8px -2px rgba(0,0,0,0.1);
            }

            .modalFooter-fa {
              padding: 16px 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-top: 1px solid #e5e7eb;
              background: #ffffff;
              flex-shrink: 0;
            }
            .footer-actions-fa {
              display: flex;
              gap: 12px;
            }

            @media (max-width: 768px) {
              .modal-filtros-avancados {
                width: calc(100vw - 24px);
                max-height: 90vh;
              }

              .modalBody-fa {
                grid-template-columns: 1fr;
                padding: 16px;
              }

              .filterCardFull-fa {
                grid-column: auto;
              }

              .modalFooter-fa {
                flex-direction: column-reverse;
                gap: 12px;
                align-items: stretch;
              }

              .modalFooter-fa > button, .footer-actions-fa {
                width: 100%;
              }
              
              .footer-actions-fa {
                flex-direction: column-reverse;
              }

              .footer-actions-fa button {
                width: 100%;
              }
            }
          `}} />
        </div>
      )}

      {/* EXPORT MODAL */}
      {isExportModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div 
            className="glass-card ultra-modal modal-enter-active" 
            style={{ width: '100%', maxWidth: 640, maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Exportar Relatório de Alunos</h2>
                  <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>Escolha os campos e formato para exportação</p>
                </div>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Fields Checklist */}
              <div>
                {/* DADOS DO ALUNO */}
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} /> 1. Dados do Aluno
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                  {[
                    { key: 'id', label: 'ID / Matrícula' },
                    { key: 'nome', label: 'Nome Completo' },
                    { key: 'email', label: 'E-mail' },
                    { key: 'telefone', label: 'Telefone' },
                    { key: 'dataNasc', label: 'Data de Nascimento' },
                    { key: 'status', label: 'Status' },
                    { key: 'sairSozinho', label: 'Autorização Saída' },
                    { key: 'unidade', label: 'Unidade Escolar' },
                    { key: 'turno', label: 'Turno' },
                    { key: 'serie', label: 'Série' },
                    { key: 'turma_anoLetivo', label: 'Ano Letivo da Turma' },
                    { key: 'turma_segmento', label: 'Segmento da Turma' },
                    { key: 'turma_nome', label: 'Nome da Turma' },
                    { key: 'inadimplente', label: 'Inadimplente (Financeiro)' },
                    { key: 'risco_evasao', label: 'Risco de Evasão' },
                    { key: 'media', label: 'Média' },
                    { key: 'frequencia', label: 'Frequência (%)' },
                    { key: 'obs', label: 'Observações' },
                    { key: 'dataCadastro', label: 'Data de Cadastro' },
                  ].map((field) => (
                    <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={exportFields[field.key]}
                        onChange={(e) => setExportFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                        style={{ width: 15, height: 15, borderRadius: 4, accentColor: '#2563eb' }}
                      />
                      {field.label}
                    </label>
                  ))}
                </div>

                {/* VÍNCULO DA TURMA */}
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <Tag size={14} /> 2. Vínculos e Histórico
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={exportFields.historicoTurmas}
                      onChange={(e) => setExportFields(prev => ({ ...prev, historicoTurmas: e.target.checked }))}
                      style={{ width: 15, height: 15, borderRadius: 4, accentColor: '#10b981' }}
                    />
                    Histórico Completo de Turmas
                  </label>
                </div>

                {/* RESPONSÁVEL FINANCEIRO */}
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <Shield size={14} /> 3. Responsável Financeiro
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                  {[
                    { key: 'respFin_id', label: 'ID do Responsável' },
                    { key: 'respFin_nome', label: 'Nome Completo' },
                    { key: 'respFin_rfid', label: 'Cartão RFID' },
                    { key: 'respFin_email', label: 'E-mail' },
                    { key: 'respFin_telefone', label: 'Telefone' },
                    { key: 'respFin_cpf', label: 'CPF' },
                    { key: 'respFin_rg', label: 'RG' },
                    { key: 'respFin_parentesco', label: 'Parentesco' },
                    { key: 'respFin_profissao', label: 'Profissão' },
                    { key: 'respFin_vinculo', label: 'Vínculo (Matrícula Aluno)' },
                    { key: 'respFin_tipo', label: 'Tipo de Responsável' },
                    { key: 'respFin_diasAcesso', label: 'Dias Permitidos Retirada' },
                    { key: 'respFin_proibido', label: 'Acesso Restrito/Proibido' },
                  ].map((field) => (
                    <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={exportFields[field.key]}
                        onChange={(e) => setExportFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                        style={{ width: 15, height: 15, borderRadius: 4, accentColor: '#8b5cf6' }}
                      />
                      {field.label}
                    </label>
                  ))}
                </div>

                {/* RESPONSÁVEL PEDAGÓGICO */}
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <Shield size={14} /> 4. Responsável Pedagógico
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                  {[
                    { key: 'respPed_id', label: 'ID do Responsável' },
                    { key: 'respPed_nome', label: 'Nome Completo' },
                    { key: 'respPed_rfid', label: 'Cartão RFID' },
                    { key: 'respPed_email', label: 'E-mail' },
                    { key: 'respPed_telefone', label: 'Telefone' },
                    { key: 'respPed_cpf', label: 'CPF' },
                    { key: 'respPed_rg', label: 'RG' },
                    { key: 'respPed_parentesco', label: 'Parentesco' },
                    { key: 'respPed_profissao', label: 'Profissão' },
                    { key: 'respPed_vinculo', label: 'Vínculo (Matrícula Aluno)' },
                    { key: 'respPed_tipo', label: 'Tipo de Responsável' },
                    { key: 'respPed_diasAcesso', label: 'Dias Permitidos Retirada' },
                    { key: 'respPed_proibido', label: 'Acesso Restrito/Proibido' },
                  ].map((field) => (
                    <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={exportFields[field.key]}
                        onChange={(e) => setExportFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                        style={{ width: 15, height: 15, borderRadius: 4, accentColor: '#ec4899' }}
                      />
                      {field.label}
                    </label>
                  ))}
                </div>

                {/* OUTROS RESPONSÁVEIS */}
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <Users size={14} /> 5. Outros Responsáveis
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={exportFields.responsaveisOutros}
                      onChange={(e) => setExportFields(prev => ({ ...prev, responsaveisOutros: e.target.checked }))}
                      style={{ width: 15, height: 15, borderRadius: 4, accentColor: '#f59e0b' }}
                    />
                    Lista de Outros Responsáveis
                  </label>
                </div>
              </div>

              <div style={{ height: '1px', background: '#e2e8f0' }} />

              {/* Filters */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>Filtrar por Data de Cadastro</h3>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>De</label>
                    <input
                      type="date"
                      className="form-input"
                      value={exportFilters.dateStart}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, dateStart: e.target.value }))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Até</label>
                    <input
                      type="date"
                      className="form-input"
                      value={exportFilters.dateEnd}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, dateEnd: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: '#e2e8f0' }} />

              {/* Format */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>Formato de Exportação</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  {[
                    { key: 'xlsx', label: 'Excel (.xlsx)' },
                    { key: 'csv', label: 'CSV (Excel)' },
                    { key: 'tsv', label: 'TSV (Tabulado)' },
                    { key: 'json', label: 'JSON' },
                  ].map((format) => (
                    <label key={format.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', border: `1.5px solid ${exportFormat === format.key ? '#2563eb' : '#e2e8f0'}`, borderRadius: 12, background: exportFormat === format.key ? 'rgba(37, 99, 235, 0.05)' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: exportFormat === format.key ? '#2563eb' : '#475569', transition: 'all 0.2s' }}>
                      <input
                        type="radio"
                        name="exportFormat"
                        value={format.key}
                        checked={exportFormat === format.key}
                        onChange={() => setExportFormat(format.key as any)}
                        style={{ display: 'none' }}
                      />
                      {format.label}
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px 32px', borderTop: '1px solid rgba(0,0,0,0.05)', background: 'transparent', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setIsExportModalOpen(false)} className="neo-btn neo-btn-secondary" style={{ padding: '10px 20px', fontSize: 13 }} disabled={isExporting}>
                Cancelar
              </button>
              <button 
                onClick={handleExportData} 
                className="neo-btn neo-btn-primary" 
                style={{ padding: '10px 24px', fontSize: 13, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', minWidth: 140 }}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" style={{ marginRight: 6 }} /> Exportando...
                  </>
                ) : (
                  <>
                    <Download size={16} /> Gerar Arquivo
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
