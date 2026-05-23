'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  Users, Search, Plus, Filter, Download, MoreHorizontal, 
  Trash2, Edit, Eye, Check, X, Camera, Upload, 
  UserPlus, SearchIcon, CreditCard, Calendar, Phone, Mail,
  MapPin, Shield, DoorOpen, HardHat, Briefcase, Tag, Sparkles,
  Loader2, Lock, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import ImportarAlunosModal from '@/components/alunos/ImportarAlunosModal'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
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
  const { cfgNiveisEnsino, logSystemAction } = useData()
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
    { page: paginaAtual, limit: itensPorPagina, search: busca, status: statusFiltro }
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
      id: '',
      nome: '',
      dataNasc: '',
      email: '',
      telefone: '',
      profissao: '',
      codigo: '',
      codigoAluno: '',
      rfid: '',
      parentesco: '',
      diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
      isFinanceiro: false,
      isPedagogico: false,
      isOutro: false,
      proibido: false
    }],
    turma: {
      serieTurma: ''
    }
  })

  const handleInputChange = (section: string, field: string, value: any, index?: number) => {
    setFormData(prev => {
      if (index !== undefined && section === 'responsaveis') {
        const newArray = [...prev.responsaveis]
        newArray[index] = { ...newArray[index], [field]: value }
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
    setFormData({
      aluno: {
        codigo: '', nome: '', dataNasc: '', telefone: '', email: '', ativo: true, autorizadoSairSozinho: false, foto: null
      },
      responsaveis: [{
        id: '', nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: '', codigoAluno: '', rfid: '', parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false
      }],
      turma: { serieTurma: '' }
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
        if (!resp.isFinanceiro && !resp.isPedagogico && !resp.isOutro) {
          errors.push({ field: `resp_${index}_tipo`, label: `Tipo de Responsável (Selecione pelo menos um: Financeiro, Pedagógico ou Outro)${suffix}`, tab: 'responsavel', tabLabel: 'Responsáveis' })
        }
      })
    }

    // 3. Turma validation
    if (!segmentoSelecionado) {
      errors.push({ field: 'segmento', label: 'Segmento', tab: 'turma', tabLabel: 'Vínculo de Turma' })
    }
    if (!formData.turma.serieTurma) {
      errors.push({ field: 'serieTurma', label: 'Série / Turma', tab: 'turma', tabLabel: 'Vínculo de Turma' })
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
      turma: formData.turma.serieTurma
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
      turma: {
        serieTurma: turmaDoAluno?.id || aluno.turma || ''
      }
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
    if (deleteModal.passwordValue !== '2757') {
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
              onClick={handleDeleteAll} 
              className="neo-btn" 
              style={{ padding: '12px 24px', fontSize: 14, background: '#dc2626', color: 'white', border: 'none', boxShadow: '0 8px 20px rgba(220, 38, 38, 0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Trash2 size={18} /> Excluir Todos
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
                <option value="todos">Todos Status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
              
              <button onClick={() => alert('Filtros avançados serão implementados em breve.')} className="neo-btn neo-btn-secondary" style={{ padding: '0 16px', height: 44 }}>
                <Filter size={16} /> Filtros Avançados
              </button>
              
              <button onClick={() => setIsImportModalOpen(true)} className="neo-btn neo-btn-secondary" style={{ padding: '0 16px', height: 44 }}>
                <Upload size={16} /> Importar
              </button>
              
              <button onClick={() => alert('Exportação de dados será implementada em breve.')} className="neo-btn neo-btn-secondary" style={{ padding: '0 16px', height: 44 }}>
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
                <th>Foto</th>
                <th>ID</th>
                <th>Nome Completo</th>
                <th>Responsáveis</th>
                <th>Contato</th>
                <th>Turma</th>
                <th>Sair Sozinho</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={5} cols={9} />
              ) : alunosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
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
                  <td style={{ color: '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>{aluno.telefone}</td>
                  <td style={{ fontWeight: 600, color: '#1d4ed8', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {todasTurmas.find((t: any) => String(t.id) === String(aluno.turma))?.nome || aluno.turma}
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
                            const reader = new FileReader()
                            reader.onloadend = () => {
                              handleInputChange('aluno', 'foto', reader.result)
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
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Buscar Responsável Existente</label>
                      <div style={{ position: 'relative' }}>
                        <SearchIcon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                          className="form-input" 
                          style={{ paddingLeft: 36 }} 
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
                      className="neo-btn neo-btn-secondary" 
                      style={{ height: 40 }}
                      disabled={loadingBuscaResp}
                    >
                      {loadingBuscaResp ? 'Buscando...' : 'Buscar'}
                    </button>
                    <div style={{ fontSize: 13, color: '#64748b', alignSelf: 'center', padding: '0 10px' }}>ou</div>
                    <button onClick={() => {
                      setFormData({ ...formData, responsaveis: [...formData.responsaveis, { id: '', nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: '', codigoAluno: '', rfid: '', parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false }] });
                      setMostrarFormResponsavel(true);
                    }} className="neo-btn neo-btn-primary" style={{ height: 40 }}>
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
                            {!resp.isFinanceiro && !resp.isPedagogico && !resp.isOutro && (
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
                          value={resp.codigo || resp.id || ''} 
                          onChange={e => {
                            handleInputChange('responsaveis', 'id', e.target.value, index);
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
                        onClick={() => setFormData({ ...formData, responsaveis: [...formData.responsaveis, { id: '', nome: '', dataNasc: '', email: '', telefone: '', profissao: '', codigo: '', codigoAluno: '', rfid: '', parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false }] })} 
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

              {/* TAB: TURMA */}
              {activeTab === 'turma' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Segmento *</label>
                    <select 
                      className="form-input" 
                      style={{ borderColor: hasError('segmento') ? '#ef4444' : undefined, boxShadow: hasError('segmento') ? '0 0 0 1px #ef4444' : undefined }}
                      value={segmentoSelecionado} 
                      onChange={e => {
                        setSegmentoSelecionado(e.target.value)
                        handleInputChange('turma', 'serieTurma', '') // Reset turma
                        if (hasError('segmento')) {
                          setValidationErrors(prev => prev.filter(err => err.field !== 'segmento'));
                        }
                      }}
                    >
                      <option value="">Selecione o segmento…</option>
                      {cfgNiveisEnsino?.map((n: any) => (
                        <option key={n.id} value={n.nome}>{n.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Série / Turma *</label>
                    <select 
                      className="form-input" 
                      style={{ borderColor: hasError('serieTurma') ? '#ef4444' : undefined, boxShadow: hasError('serieTurma') ? '0 0 0 1px #ef4444' : undefined }}
                      value={formData.turma.serieTurma} 
                      onChange={e => {
                        handleInputChange('turma', 'serieTurma', e.target.value);
                        if (hasError('serieTurma')) {
                          setValidationErrors(prev => prev.filter(err => err.field !== 'serieTurma'));
                        }
                      }}
                      disabled={!segmentoSelecionado}
                    >
                      <option value="">Selecione a turma…</option>
                      {todasTurmas
                        .filter((t: any) => t.dados?.segmento === segmentoSelecionado)
                        .map((t: any) => (
                          <option key={t.id} value={t.id}>{t.nome} ({t.serie})</option>
                        ))}
                    </select>
                  </div>
                  
                  <div style={{ background: 'rgba(59,130,246,0.05)', padding: '16px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>Dica de Secretário</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Vincular o aluno a uma turma automaticamente gera sua agenda de aulas e horários.</p>
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
                </p>

                <form onSubmit={handleConfirmDeleteAllPassword}>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#64748b" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="password"
                      placeholder="Digite a Senha de Segurança"
                      value={deleteModal.passwordValue}
                      onChange={(e) => setDeleteModal(prev => ({ ...prev, passwordValue: e.target.value }))}
                      style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: 12, border: deleteModal.wrongPasswordError ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.2)', color: '#fff', fontSize: 14, outline: 'none', transition: 'all 0.2s' }}
                      autoFocus
                    />
                  </div>
                  {deleteModal.wrongPasswordError && (
                    <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, margin: '8px 0 0', textAlign: 'left' }}>Senha incorreta! Acesso negado.</p>
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
    </>
  )
}
