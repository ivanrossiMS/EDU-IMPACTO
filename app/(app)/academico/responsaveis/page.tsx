'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { 
  Plus, Search, Trash2, Edit2, Phone, Mail, Users, Filter, Download, 
  Tag, CreditCard, X, Save, Loader2, ChevronLeft, ChevronRight,
  MapPin, Briefcase, Check, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Copy
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { UpdatingIndicator } from '@/components/skeletons/States'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import { useData } from '@/lib/dataContext'
import { formatPhone } from '@/lib/utils'

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

const formatCpfMask = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

const formatCepMask = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

const createEmptyResponsavel = () => ({
  id: '',
  nome: '',
  dataNasc: '',
  email: '',
  telefone: '',
  profissao: '',
  rfid: '',
  parentesco: '',
  cpf: '',
  rg: '',
  rgOrgaoEmissor: '',
  sexo: '',
  estadoCivil: '',
  nacionalidade: 'Brasileira',
  naturalidade: '',
  naturalidadeUf: '',
  // Residencial
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  // Comercial
  comercialEmpresa: '',
  comercialTelefone: '',
  comercialCep: '',
  comercialEndereco: '',
  comercialNumero: '',
  comercialComplemento: '',
  comercialBairro: '',
  comercialCidade: '',
  comercialUf: '',
  // Acesso e vínculos
  diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
  isFinanceiro: false,
  isPedagogico: false,
  isOutro: false,
  proibido: false,
  alunosVinculados: [] as any[]
})

export default function ResponsaveisPage() {
  const queryClient = useQueryClient()
  const { logSystemAction } = useData()
  
  const [search, setSearch] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(10)

  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [isModalOpen])
  const [editingResponsavel, setEditingResponsavel] = useState<any | null>(null)
  const [buscaAluno, setBuscaAluno] = useState('')
  const [resultadosAlunos, setResultadosAlunos] = useState<any[]>([])
  
  // Estado do formulário do modal com todos os campos espelhados
  const [formResponsaveis, setFormResponsaveis] = useState([createEmptyResponsavel()])
  const [loading, setLoading] = useState(false)

  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([])
  const hasError = (fieldKey: string) => validationErrors.some(e => e.field === fieldKey)

  const getMandatoryFieldStyle = (
    value: any,
    fieldKey: string
  ): React.CSSProperties => {
    const isFilled = Boolean(value !== undefined && value !== null && String(value).trim().length > 0)
    const isError = hasError(fieldKey)

    if (isError) {
      return {
        borderColor: '#ef4444',
        borderWidth: '2px',
        borderStyle: 'solid',
        boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.25)',
        background: '#fff5f5',
        transition: 'all 0.2s ease-in-out'
      }
    }

    if (isFilled) {
      return {
        borderColor: '#10b981', // Verde bem visível após preenchimento
        borderWidth: '2px',
        borderStyle: 'solid',
        boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)',
        background: 'rgba(236, 253, 245, 0.6)',
        transition: 'all 0.2s ease-in-out'
      }
    }

    // Pendente / vazio: Borda amarela bem visível
    return {
      borderColor: '#eab308', // Amarelo bem visível quando pendente
      borderWidth: '2px',
      borderStyle: 'solid',
      boxShadow: '0 0 0 2px rgba(234, 179, 8, 0.3)',
      background: 'rgba(254, 252, 232, 0.65)',
      transition: 'all 0.2s ease-in-out'
    }
  }

  const [loadingCep, setLoadingCep] = useState<Record<string, boolean>>({})
  const [cepFeedback, setCepFeedback] = useState<Record<string, { type: 'success' | 'error', message: string } | null>>({})
  const [expandedComercial, setExpandedComercial] = useState<Record<number, boolean>>({})

  const toggleComercial = (index: number) => {
    setExpandedComercial(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const buscarCepResidencial = async (rawCep: string, index: number) => {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return

    const key = `${index}_res`
    setLoadingCep(prev => ({ ...prev, [key]: true }))
    setCepFeedback(prev => ({ ...prev, [key]: null }))
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error('Falha na requisição')
      const data = await res.json()
      if (data.erro) {
        setCepFeedback(prev => ({ ...prev, [key]: { type: 'error', message: 'CEP não encontrado' } }))
      } else {
        setFormResponsaveis(prev => {
          const newArr = [...prev]
          if (newArr[index]) {
            newArr[index] = {
              ...newArr[index],
              endereco: data.logradouro || newArr[index].endereco || '',
              bairro: data.bairro || newArr[index].bairro || '',
              cidade: data.localidade || newArr[index].cidade || '',
              uf: data.uf || newArr[index].uf || '',
              complemento: data.complemento && !newArr[index].complemento ? data.complemento : newArr[index].complemento
            }
          }
          return newArr
        })
        setCepFeedback(prev => ({ ...prev, [key]: { type: 'success', message: `${data.localidade} - ${data.uf}` } }))
      }
    } catch {
      setCepFeedback(prev => ({ ...prev, [key]: { type: 'error', message: 'Erro ao consultar CEP' } }))
    } finally {
      setLoadingCep(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleCepResidencialChange = (val: string, index: number) => {
    const formatted = formatCepMask(val)
    handleInputChange('cep', formatted, index)
    const digits = formatted.replace(/\D/g, '')
    const key = `${index}_res`
    if (digits.length === 8) {
      buscarCepResidencial(digits, index)
    } else {
      setCepFeedback(prev => ({ ...prev, [key]: null }))
    }
  }

  const buscarCepComercial = async (rawCep: string, index: number) => {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return

    const key = `${index}_com`
    setLoadingCep(prev => ({ ...prev, [key]: true }))
    setCepFeedback(prev => ({ ...prev, [key]: null }))
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error('Falha na requisição')
      const data = await res.json()
      if (data.erro) {
        setCepFeedback(prev => ({ ...prev, [key]: { type: 'error', message: 'CEP não encontrado' } }))
      } else {
        setFormResponsaveis(prev => {
          const newArr = [...prev]
          if (newArr[index]) {
            newArr[index] = {
              ...newArr[index],
              comercialEndereco: data.logradouro || newArr[index].comercialEndereco || '',
              comercialBairro: data.bairro || newArr[index].comercialBairro || '',
              comercialCidade: data.localidade || newArr[index].comercialCidade || '',
              comercialUf: data.uf || newArr[index].comercialUf || '',
              comercialComplemento: data.complemento && !newArr[index].comercialComplemento ? data.complemento : newArr[index].comercialComplemento
            }
          }
          return newArr
        })
        setCepFeedback(prev => ({ ...prev, [key]: { type: 'success', message: `${data.localidade} - ${data.uf}` } }))
      }
    } catch {
      setCepFeedback(prev => ({ ...prev, [key]: { type: 'error', message: 'Erro ao consultar CEP' } }))
    } finally {
      setLoadingCep(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleCepComercialChange = (val: string, index: number) => {
    const formatted = formatCepMask(val)
    handleInputChange('comercialCep', formatted, index)
    const digits = formatted.replace(/\D/g, '')
    const key = `${index}_com`
    if (digits.length === 8) {
      buscarCepComercial(digits, index)
    } else {
      setCepFeedback(prev => ({ ...prev, [key]: null }))
    }
  }

  const handleCopiarEnderecoResidencialParaComercial = (index: number) => {
    setFormResponsaveis(prev => {
      const newArr = [...prev]
      const resp = newArr[index]
      if (!resp) return prev
      newArr[index] = {
        ...resp,
        comercialCep: resp.cep || '',
        comercialEndereco: resp.endereco || '',
        comercialNumero: resp.numero || '',
        comercialComplemento: resp.complemento || '',
        comercialBairro: resp.bairro || '',
        comercialCidade: resp.cidade || '',
        comercialUf: resp.uf || ''
      }
      return newArr
    })
    setExpandedComercial(prev => ({ ...prev, [index]: true }))
  }

  // Query para buscar responsáveis (Cache via React Query)
  const { data: apiResponse, isLoading: loadingList, isFetching } = useApiQuery<{ data: any[], total: number }>(
    ['responsaveis', String(paginaAtual), String(itensPorPagina), search],
    '/api/responsaveis',
    { page: paginaAtual, limit: itensPorPagina, search: search }
  )

  const responsaveis = apiResponse?.data || []
  const total = apiResponse?.total || 0

  useEffect(() => {
    if (buscaAluno.length >= 3) {
      const fetchAlunos = async () => {
        try {
          const res = await fetch(`/api/alunos?search=${buscaAluno}`)
          const json = await res.json()
          setResultadosAlunos(json.data || [])
        } catch (e) {
          console.error('Error searching students:', e)
        }
      }
      fetchAlunos()
    } else {
      setResultadosAlunos([])
    }
  }, [buscaAluno])

  const totalPaginas = Math.ceil(total / itensPorPagina)
  
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5
    
    if (totalPaginas <= maxVisiblePages) {
      for (let i = 1; i <= totalPaginas; i++) {
        pages.push(i)
      }
    } else {
      let start = Math.max(1, paginaAtual - 2)
      let end = Math.min(totalPaginas, paginaAtual + 2)
      
      if (paginaAtual <= 3) {
        start = 1
        end = maxVisiblePages
      } else if (paginaAtual >= totalPaginas - 2) {
        start = totalPaginas - maxVisiblePages + 1
        end = totalPaginas
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
    }
    return pages
  }

  const responsaveisPaginados = responsaveis

  const handleNovoResponsavel = () => {
    setEditingResponsavel(null)
    setFormResponsaveis([createEmptyResponsavel()])
    setValidationErrors([])
    setExpandedComercial({ 0: false })
    setIsModalOpen(true)
  }

  const handleEdit = (resp: any) => {
    setEditingResponsavel(resp)
    const d = resp.dados || {}
    const hasComercial = Boolean(
      resp.comercialEmpresa || d.comercialEmpresa ||
      resp.comercialTelefone || d.comercialTelefone ||
      resp.comercialCep || d.comercialCep ||
      resp.comercialEndereco || d.comercialEndereco ||
      resp.comercialNumero || d.comercialNumero ||
      resp.comercialComplemento || d.comercialComplemento ||
      resp.comercialBairro || d.comercialBairro ||
      resp.comercialCidade || d.comercialCidade ||
      resp.comercialUf || d.comercialUf
    )
    setFormResponsaveis([{
      id: resp.id || '',
      nome: resp.nome || '',
      dataNasc: resp.dataNasc || resp.data_nasc || d.dataNasc || '',
      email: resp.email || '',
      telefone: resp.telefone || '',
      profissao: resp.profissao || d.profissao || '',
      rfid: resp.rfid || '',
      parentesco: resp.parentesco || (resp.alunosVinculados?.[0]?.parentesco) || '',
      diasAcesso: resp.diasAcesso || resp.dias_acesso || d.diasAcesso || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
      isFinanceiro: resp.isFinanceiro ?? resp.alunosVinculados?.some((a: any) => a.isFinanceiro) ?? false,
      isPedagogico: resp.isPedagogico ?? resp.alunosVinculados?.some((a: any) => a.isPedagogico) ?? false,
      isOutro: resp.isOutro ?? resp.alunosVinculados?.some((a: any) => a.isOutro) ?? false,
      proibido: resp.proibido === true,
      cpf: resp.cpf || d.cpf || '',
      rg: resp.rg || d.rg || '',
      rgOrgaoEmissor: resp.rgOrgaoEmissor || d.rgOrgaoEmissor || d.orgEmissor || '',
      sexo: resp.sexo || d.sexo || '',
      estadoCivil: resp.estadoCivil || resp.estado_civil || d.estadoCivil || '',
      nacionalidade: resp.nacionalidade || d.nacionalidade || 'Brasileira',
      naturalidade: resp.naturalidade || d.naturalidade || '',
      naturalidadeUf: resp.naturalidadeUf || d.naturalidadeUf || '',
      cep: resp.cep || d.cep || '',
      endereco: resp.endereco || d.endereco || d.logradouro || '',
      numero: resp.numero || d.numero || '',
      complemento: resp.complemento || d.complemento || '',
      bairro: resp.bairro || d.bairro || '',
      cidade: resp.cidade || d.cidade || '',
      uf: resp.uf || d.uf || d.ufEnd || '',
      comercialEmpresa: resp.comercialEmpresa || d.comercialEmpresa || '',
      comercialTelefone: resp.comercialTelefone || d.comercialTelefone || '',
      comercialCep: resp.comercialCep || d.comercialCep || '',
      comercialEndereco: resp.comercialEndereco || d.comercialEndereco || '',
      comercialNumero: resp.comercialNumero || d.comercialNumero || '',
      comercialComplemento: resp.comercialComplemento || d.comercialComplemento || '',
      comercialBairro: resp.comercialBairro || d.comercialBairro || '',
      comercialCidade: resp.comercialCidade || d.comercialCidade || '',
      comercialUf: resp.comercialUf || d.comercialUf || '',
      alunosVinculados: resp.alunosVinculados || []
    }])
    setExpandedComercial({ 0: hasComercial })
    setValidationErrors([])
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este responsável?')) return
    try {
      const respExcluido = apiResponse?.data?.find((r: any) => r.id === id)
      const nomeResp = respExcluido?.nome || id
      const res = await fetch(`/api/responsaveis?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
      
      logSystemAction(
        'Acadêmico (Responsáveis)',
        'Exclusão',
        `Exclusão do responsável ${nomeResp}`,
        { registroId: id, detalhesAntes: respExcluido }
      )
      
      queryClient.invalidateQueries({ queryKey: ['responsaveis'] })
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleInputChange = (field: string, value: any, index: number) => {
    const updated = [...formResponsaveis]
    updated[index] = { ...updated[index], [field]: value }
    setFormResponsaveis(updated)
  }

  const handleSave = async () => {
    // Validação de campos obrigatórios: Nome Completo e E-mail (se Financeiro)
    const errors: { field: string; message: string }[] = []
    formResponsaveis.forEach((resp, idx) => {
      if (!resp.nome || !resp.nome.trim()) {
        errors.push({ field: `resp_${idx}_nome`, message: 'Nome Completo é obrigatório' })
      }
      // O e-mail NÃO deve ser obrigatório para o tipo "outro" nem "pedagógico", apenas para "financeiro"
      if (resp.isFinanceiro && (!resp.email || !resp.email.trim())) {
        errors.push({ field: `resp_${idx}_email`, message: 'E-mail é obrigatório para o Responsável Financeiro' })
      }
    })

    if (errors.length > 0) {
      setValidationErrors(errors)
      alert('Por favor, preencha os campos obrigatórios destacados.')
      return
    }

    setLoading(true)
    try {
      const resp = formResponsaveis[0] // Assume apenas um item
      const payload = {
        ...resp,
        alunos_vinculados: resp.alunosVinculados.map((aluno: any) => ({
          aluno_id: typeof aluno === 'object' ? aluno.id : aluno,
          parentesco: resp.parentesco,
          resp_pedagogico: resp.isPedagogico,
          resp_financeiro: resp.isFinanceiro,
          resp_outro: resp.isOutro
        }))
      }

      const method = editingResponsavel ? 'PUT' : 'POST'
      const url = editingResponsavel ? `/api/responsaveis?id=${editingResponsavel.id}` : '/api/responsaveis'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro ao salvar responsável')
      }
      
      const savedData = await res.json()
      const realId = savedData.id || editingResponsavel?.id || payload.id
      logSystemAction(
        'Acadêmico (Responsáveis)',
        editingResponsavel ? 'Edição' : 'Cadastro',
        `${editingResponsavel ? 'Atualização' : 'Cadastro'} do responsável ${payload.nome}`,
        { registroId: realId, detalhesDepois: payload }
      )
      
      queryClient.invalidateQueries({ queryKey: ['responsaveis'] })
      queryClient.invalidateQueries({ queryKey: ['alunos'] })
      setIsModalOpen(false)
      setEditingResponsavel(null)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="page-container responsaveis-page-container" style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div className="responsaveis-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Responsáveis
            {isFetching && <UpdatingIndicator />}
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Gerenciamento de pais e responsáveis do sistema</p>
        </div>
        <div className="responsaveis-header-actions">
          <button
            onClick={handleNovoResponsavel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
            }}
          >
            <Plus size={16} /> Novo Responsável
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="responsaveis-toolbar" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36, background: '#fff' }}
            placeholder="Buscar por nome, e-mail, telefone ou RFID..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPaginaAtual(1)
            }}
          />
        </div>
        <div className="responsaveis-toolbar-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="neo-btn neo-btn-secondary" style={{ gap: 8 }}>
            <Filter size={16} /> Filtros
          </button>
          <button className="neo-btn neo-btn-secondary" style={{ gap: 8 }}>
            <Download size={16} /> Exportar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card responsaveis-table-card" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Nome Completo</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Alunos Vinculados</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Tipo</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Contato</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Dias de Acesso</th>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Permissão</th>
              <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <TableSkeleton rows={10} cols={8} />
            ) : responsaveisPaginados.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                  Nenhum responsável encontrado.
                </td>
              </tr>
            ) : (
              responsaveisPaginados.map(resp => (
                <tr key={resp.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff', transition: 'background 0.2s' }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{resp.codigo || resp.id?.substring(0, 8)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{resp.nome}</span>
                      {(resp.cpf || resp.dados?.cpf) && (
                        <span style={{ fontSize: 11, color: '#64748b' }}>CPF: {formatCpfMask(resp.cpf || resp.dados?.cpf)}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {resp.alunosVinculados && resp.alunosVinculados.length > 0 ? (
                        resp.alunosVinculados.map((aluno: any) => (
                          <span key={aluno.id} style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Users size={12} style={{ color: '#3b82f6' }} /> {aluno.nome || `ID: ${aluno.id}`}
                            {aluno.parentesco && <span style={{ marginLeft: 4, padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '12px', fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>{aluno.parentesco}</span>}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Nenhum aluno</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {resp.alunosVinculados?.some((aluno: any) => aluno.isFinanceiro) && (
                        <span style={{ padding: '2px 8px', background: '#10b981', color: '#fff', borderRadius: '12px', fontSize: 11, fontWeight: 700 }}>Financeiro</span>
                      )}
                      {resp.alunosVinculados?.some((aluno: any) => aluno.isPedagogico) && (
                        <span style={{ padding: '2px 8px', background: '#8b5cf6', color: '#fff', borderRadius: '12px', fontSize: 11, fontWeight: 700 }}>Pedagógico</span>
                      )}
                      {resp.alunosVinculados?.some((aluno: any) => aluno.isOutro) && (
                        <span style={{ padding: '2px 8px', background: '#f59e0b', color: '#fff', borderRadius: '12px', fontSize: 11, fontWeight: 700 }}>Outro</span>
                      )}
                      {!resp.alunosVinculados?.some((aluno: any) => aluno.isFinanceiro || aluno.isPedagogico || aluno.isOutro) && (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {resp.telefone && (
                        <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={12} style={{ color: '#10b981' }} /> {resp.telefone}
                        </span>
                      )}
                      {resp.email && (
                        <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail size={12} style={{ color: '#3b82f6' }} /> {resp.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {resp.dias_acesso && resp.dias_acesso.length > 0 ? (
                        resp.dias_acesso.map((dia: string) => (
                          <span key={dia} style={{ padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: 11, fontWeight: 700 }}>
                            {dia}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Nenhum dia</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      fontSize: 11, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      background: resp.proibido ? '#fee2e2' : '#dcfce7',
                      color: resp.proibido ? '#991b1b' : '#166534'
                    }}>
                      {resp.proibido ? 'Proibido' : 'Liberado'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                      <button
                        onClick={() => handleEdit(resp)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          color: '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(resp.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#ef4444',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {total > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
          padding: '16px 24px',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
          border: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: 16
        }}>
          {/* Left Side: Items selection & summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Exibir</span>
            <div style={{ position: 'relative' }}>
              <select
                value={itensPorPagina}
                onChange={e => {
                  setItensPorPagina(Number(e.target.value))
                  setPaginaAtual(1)
                }}
                style={{
                  appearance: 'none',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '6px 32px 6px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1e293b',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s',
                  minWidth: 70
                }}
                className="select-itens-pagina"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 10,
                color: '#64748b',
                pointerEvents: 'none'
              }}>▼</span>
            </div>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
              por página. Mostrando <strong style={{ color: '#0f172a' }}>{Math.min(total, (paginaAtual - 1) * itensPorPagina + 1)}-{Math.min(total, paginaAtual * itensPorPagina)}</strong> de <strong style={{ color: '#0f172a' }}>{total}</strong> responsáveis.
            </span>
          </div>

          {/* Right Side: Page numbering navigation */}
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Previous button */}
              <button
                onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: paginaAtual === 1 ? '#f1f5f9' : '#fff',
                  color: paginaAtual === 1 ? '#94a3b8' : '#475569',
                  cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: paginaAtual === 1 ? 'none' : '0 2px 4px rgba(0,0,0,0.02)'
                }}
                className="pagination-arrow-btn"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Numbered buttons */}
              {getPageNumbers().map(num => {
                const isActive = num === paginaAtual
                return (
                  <button
                    key={num}
                    onClick={() => setPaginaAtual(num)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      border: isActive ? 'none' : '1px solid #e2e8f0',
                      background: isActive ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#fff',
                      color: isActive ? '#fff' : '#475569',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    className={isActive ? 'pagination-num-btn active' : 'pagination-num-btn'}
                  >
                    {num}
                  </button>
                )
              })}

              {/* Next button */}
              <button
                onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: paginaAtual === totalPaginas ? '#f1f5f9' : '#fff',
                  color: paginaAtual === totalPaginas ? '#94a3b8' : '#475569',
                  cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: paginaAtual === totalPaginas ? 'none' : '0 2px 4px rgba(0,0,0,0.02)'
                }}
                className="pagination-arrow-btn"
                title="Próxima Página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Idêntico ao de Alunos Passo Responsável com Cabeçalho Gradiente */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: 16, width: 'min(980px, 96vw)', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            
            {/* Header do Modal com Gradiente Escuro Ultra Moderno */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', margin: '-24px -24px 20px -24px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{editingResponsavel ? 'Editar Responsável' : 'Novo Responsável'}</h2>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Preencha os dados completos do responsável abaixo</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {formResponsaveis.map((resp, index) => {
                const isExpandedComercial = !!expandedComercial[index]
                const hasComercialData = Boolean(
                  resp.comercialEmpresa ||
                  resp.comercialTelefone ||
                  resp.comercialCep ||
                  resp.comercialEndereco ||
                  resp.comercialNumero ||
                  resp.comercialComplemento ||
                  resp.comercialBairro ||
                  resp.comercialCidade ||
                  resp.comercialUf
                )

                return (
                  <div key={index} style={{ border: '1px solid #e2e8f0', padding: 18, borderRadius: 12, background: 'rgba(255,255,255,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    {/* Header do Card com Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                        {formResponsaveis.length > 1 ? `Dados do Responsável #${index + 1}` : 'Dados do Responsável'}
                      </h3>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const val = !resp.isFinanceiro;
                            handleInputChange('isFinanceiro', val, index);
                            if (!val) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`));
                            }
                          }}
                          style={{
                            padding: '5px 14px',
                            borderRadius: '20px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            border: '1px solid',
                            borderColor: resp.isFinanceiro ? '#10b981' : '#e2e8f0',
                            background: resp.isFinanceiro ? '#10b981' : '#fff',
                            color: resp.isFinanceiro ? '#fff' : '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: resp.isFinanceiro ? '0 2px 6px rgba(16, 185, 129, 0.3)' : 'none'
                          }}
                        >
                          Financeiro
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange('isPedagogico', !resp.isPedagogico, index);
                            if (!resp.isFinanceiro) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`));
                            }
                          }}
                          style={{
                            padding: '5px 14px',
                            borderRadius: '20px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            border: '1px solid',
                            borderColor: resp.isPedagogico ? '#8b5cf6' : '#e2e8f0',
                            background: resp.isPedagogico ? '#8b5cf6' : '#fff',
                            color: resp.isPedagogico ? '#fff' : '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: resp.isPedagogico ? '0 2px 6px rgba(139, 92, 246, 0.3)' : 'none'
                          }}
                        >
                          Pedagógico
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange('isOutro', !resp.isOutro, index);
                            if (!resp.isFinanceiro) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`));
                            }
                          }}
                          style={{
                            padding: '5px 14px',
                            borderRadius: '20px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            border: '1px solid',
                            borderColor: resp.isOutro ? '#f59e0b' : '#e2e8f0',
                            background: resp.isOutro ? '#f59e0b' : '#fff',
                            color: resp.isOutro ? '#fff' : '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: resp.isOutro ? '0 2px 6px rgba(245, 158, 11, 0.3)' : 'none'
                          }}
                        >
                          Outro
                        </button>
                      </div>
                    </div>
                    
                    {/* SUB-SECTION 1: DADOS PESSOAIS E DOCUMENTOS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Linha 1: ID, Nome Completo *, Parentesco */}
                      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 220px', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>ID</label>
                          <input 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Ex: RESP001" 
                            value={resp.id} 
                            onChange={e => handleInputChange('id', e.target.value, index)} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Nome Completo *</label>
                          <input 
                            className="form-input" 
                            style={{ ...getMandatoryFieldStyle(resp.nome, `resp_${index}_nome`), height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Nome do responsável" 
                            value={resp.nome} 
                            onChange={e => {
                              handleInputChange('nome', e.target.value, index)
                              if (hasError(`resp_${index}_nome`)) {
                                setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_nome`))
                              }
                            }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Parentesco</label>
                          <select 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            value={resp.parentesco} 
                            onChange={e => handleInputChange('parentesco', e.target.value, index)}
                          >
                            <option value="">Selecione…</option>
                            <option value="pai">Pai</option>
                            <option value="mae">Mãe</option>
                            <option value="responsavel_legal">Responsável Legal</option>
                            <option value="padrasto">Padrasto</option>
                            <option value="madrasta">Madrasta</option>
                            <option value="avo">Avô / Avó</option>
                            <option value="tio">Tio / Tia</option>
                            <option value="irmao">Irmão / Irmã</option>
                            <option value="outro">Outro</option>
                          </select>
                        </div>
                      </div>

                      {/* Linha 2: CPF, RG, Órgão Emissor / UF, Data de Nascimento */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>CPF</label>
                          <input 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="000.000.000-00" 
                            value={resp.cpf || ''} 
                            onChange={e => handleInputChange('cpf', formatCpfMask(e.target.value), index)} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>RG</label>
                          <input 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Número do RG" 
                            value={resp.rg || ''} 
                            onChange={e => handleInputChange('rg', e.target.value, index)} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Órgão Emissor / UF</label>
                          <input 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Ex: SSP/SP" 
                            value={resp.rgOrgaoEmissor || ''} 
                            onChange={e => handleInputChange('rgOrgaoEmissor', e.target.value, index)} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Data de Nascimento</label>
                          <input 
                            type="date" 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            value={resp.dataNasc || ''} 
                            onChange={e => handleInputChange('dataNasc', e.target.value, index)} 
                          />
                        </div>
                      </div>

                      {/* Linha 3: Sexo, Estado Civil, Profissão, Naturalidade com UF, Nacionalidade */}
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 160px 1.2fr 1.5fr 130px', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Sexo</label>
                          <select 
                            className="form-input" 
                            style={{ height: 40, padding: '0 10px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            value={resp.sexo || ''} 
                            onChange={e => handleInputChange('sexo', e.target.value, index)}
                          >
                            <option value="">Selecione...</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Feminino">Feminino</option>
                            <option value="Outro">Outro</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Estado Civil</label>
                          <select 
                            className="form-input" 
                            style={{ height: 40, padding: '0 10px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            value={resp.estadoCivil || ''} 
                            onChange={e => handleInputChange('estadoCivil', e.target.value, index)}
                          >
                            <option value="">Selecione...</option>
                            <option value="Solteiro(a)">Solteiro(a)</option>
                            <option value="Casado(a)">Casado(a)</option>
                            <option value="Divorciado(a)">Divorciado(a)</option>
                            <option value="Viúvo(a)">Viúvo(a)</option>
                            <option value="União Estável">União Estável</option>
                            <option value="Separado(a)">Separado(a)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Profissão</label>
                          <input 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Ex: Engenheiro(a)..." 
                            value={resp.profissao || ''} 
                            onChange={e => handleInputChange('profissao', e.target.value, index)} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Naturalidade (Cidade / UF)</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input 
                              className="form-input" 
                              style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, flex: 1, boxSizing: 'border-box' }}
                              placeholder="Cidade natal" 
                              value={resp.naturalidade || ''} 
                              onChange={e => handleInputChange('naturalidade', e.target.value, index)} 
                            />
                            <select 
                              className="form-input" 
                              style={{ width: 80, height: 40, padding: '0 6px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                              value={resp.naturalidadeUf || ''} 
                              onChange={e => handleInputChange('naturalidadeUf', e.target.value, index)}
                            >
                              <option value="">UF...</option>
                              {ESTADOS_BRASIL.map(uf => (
                                <option key={uf} value={uf}>{uf}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Nacionalidade</label>
                          <input 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Ex: Brasileira" 
                            value={resp.nacionalidade || 'Brasileira'} 
                            onChange={e => handleInputChange('nacionalidade', e.target.value, index)} 
                          />
                        </div>
                      </div>

                      {/* Linha 4: Contato & Acesso */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1.2fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Telefone / WhatsApp</label>
                          <input 
                            className="form-input" 
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="(00)00000-0000" 
                            value={resp.telefone || ''} 
                            onChange={e => handleInputChange('telefone', formatPhone(e.target.value), index)} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>
                            E-mail {resp.isFinanceiro ? '*' : ''}
                          </label>
                          <input 
                            type="email" 
                            className="form-input" 
                            style={{ 
                              ...(resp.isFinanceiro 
                                ? getMandatoryFieldStyle(resp.email, `resp_${index}_email`)
                                : hasError(`resp_${index}_email`)
                                  ? {
                                      borderColor: '#ef4444',
                                      borderWidth: '2px',
                                      borderStyle: 'solid',
                                      boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.25)',
                                      background: '#fff5f5'
                                    }
                                  : {}), 
                              height: 40, 
                              padding: '0 12px', 
                              fontSize: 13, 
                              borderRadius: 8,
                              boxSizing: 'border-box'
                            }}
                            placeholder="email@exemplo.com" 
                            value={resp.email || ''} 
                            onChange={e => {
                              handleInputChange('email', e.target.value, index)
                              if (hasError(`resp_${index}_email`)) {
                                setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`))
                              }
                            }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Cartão RFID</label>
                          <div style={{ position: 'relative' }}>
                            <CreditCard size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input 
                              className="form-input" 
                              style={{ height: 40, paddingLeft: 36, paddingRight: 12, fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }} 
                              placeholder="Aproxime o cartão…" 
                              value={resp.rfid || ''} 
                              onChange={e => handleInputChange('rfid', e.target.value, index)} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SUB-SECTION 2: ENDEREÇO RESIDENCIAL COM VIACEP */}
                    <div style={{ background: 'rgba(248, 250, 252, 0.8)', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={14} color="#2563eb" />
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Endereço Residencial
                          </span>
                          {loadingCep[`${index}_res`] && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                              <Loader2 size={12} className="animate-spin" /> Buscando CEP...
                            </span>
                          )}
                          {cepFeedback[`${index}_res`]?.type === 'success' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#059669', fontWeight: 700 }}>
                              <CheckCircle2 size={13} /> {cepFeedback[`${index}_res`]?.message}
                            </span>
                          )}
                          {cepFeedback[`${index}_res`]?.type === 'error' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                              <AlertTriangle size={13} /> {cepFeedback[`${index}_res`]?.message}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 160px', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>CEP</label>
                          <input
                            className="form-input"
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="00000-000"
                            value={resp.cep || ''}
                            onChange={e => handleCepResidencialChange(e.target.value, index)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Endereço / Logradouro</label>
                          <input
                            className="form-input"
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Rua, Avenida, Travessa..."
                            value={resp.endereco || ''}
                            onChange={e => handleInputChange('endereco', e.target.value, index)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Número</label>
                          <input
                            className="form-input"
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Nº"
                            value={resp.numero || ''}
                            onChange={e => handleInputChange('numero', e.target.value, index)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Complemento</label>
                          <input
                            className="form-input"
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Apto, Bloco..."
                            value={resp.complemento || ''}
                            onChange={e => handleInputChange('complemento', e.target.value, index)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 90px', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Bairro</label>
                          <input
                            className="form-input"
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Bairro"
                            value={resp.bairro || ''}
                            onChange={e => handleInputChange('bairro', e.target.value, index)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Cidade</label>
                          <input
                            className="form-input"
                            style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            placeholder="Cidade"
                            value={resp.cidade || ''}
                            onChange={e => handleInputChange('cidade', e.target.value, index)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>UF</label>
                          <select
                            className="form-input"
                            style={{ height: 40, padding: '0 8px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                            value={resp.uf || ''}
                            onChange={e => handleInputChange('uf', e.target.value, index)}
                          >
                            <option value="">UF...</option>
                            {ESTADOS_BRASIL.map(uf => (
                              <option key={uf} value={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SUB-SECTION 3: ENDEREÇO COMERCIAL (RECOLHIDO POR PADRÃO COM ACCORDION) */}
                    <div
                      style={{
                        background: isExpandedComercial 
                          ? 'rgba(248, 250, 252, 0.9)' 
                          : hasComercialData 
                            ? 'rgba(245, 243, 255, 0.5)' 
                            : 'rgba(248, 250, 252, 0.6)',
                        border: isExpandedComercial 
                          ? '1px solid #cbd5e1' 
                          : hasComercialData 
                            ? '1px solid #ddd6fe' 
                            : '1px dashed #cbd5e1',
                        borderRadius: 10,
                        marginTop: 14,
                        overflow: 'hidden',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Accordion Header */}
                      <div
                        onClick={() => toggleComercial(index)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleComercial(index)
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          background: isExpandedComercial ? 'rgba(241, 245, 249, 0.7)' : 'transparent',
                          borderBottom: isExpandedComercial ? '1px solid #e2e8f0' : 'none',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: isExpandedComercial ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Briefcase size={14} color="#7c3aed" />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Endereço Comercial / Trabalho
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                            (Opcional)
                          </span>

                          {hasComercialData && !isExpandedComercial && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#059669',
                                background: 'rgba(5, 150, 105, 0.09)',
                                border: '1px solid rgba(5, 150, 105, 0.25)',
                                padding: '2px 8px',
                                borderRadius: 999
                              }}
                            >
                              <Check size={11} /> Preenchido {resp.comercialEmpresa ? `• ${resp.comercialEmpresa}` : ''}
                            </span>
                          )}

                          {isExpandedComercial && (
                            <>
                              {loadingCep[`${index}_com`] && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
                                  <Loader2 size={12} className="animate-spin" /> Buscando CEP...
                                </span>
                              )}
                              {cepFeedback[`${index}_com`]?.type === 'success' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#059669', fontWeight: 700 }}>
                                  <CheckCircle2 size={13} /> {cepFeedback[`${index}_com`]?.message}
                                </span>
                              )}
                              {cepFeedback[`${index}_com`]?.type === 'error' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                                  <AlertTriangle size={13} /> {cepFeedback[`${index}_com`]?.message}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isExpandedComercial && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                handleCopiarEnderecoResidencialParaComercial(index)
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: '#4f46e5',
                                background: 'rgba(79, 70, 229, 0.08)',
                                border: '1px solid rgba(79, 70, 229, 0.25)',
                                borderRadius: 6,
                                padding: '5px 12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title="Preenche o endereço comercial com os dados do residencial"
                            >
                              <Copy size={12} /> Copiar do Residencial
                            </button>
                          )}

                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: isExpandedComercial ? '#64748b' : '#7c3aed',
                              background: isExpandedComercial ? '#f1f5f9' : 'rgba(124, 58, 237, 0.08)',
                              border: isExpandedComercial ? '1px solid #e2e8f0' : '1px solid rgba(124, 58, 237, 0.25)',
                              borderRadius: 6,
                              padding: '5px 12px'
                            }}
                          >
                            {isExpandedComercial ? (
                              <>Recolher <ChevronUp size={13} /></>
                            ) : (
                              <>{hasComercialData ? 'Visualizar / Editar' : 'Preencher Endereço Comercial'} <ChevronDown size={13} /></>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Accordion Content (Expandido) */}
                      {isExpandedComercial && (
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 140px', gap: 12, marginBottom: 12 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Empresa / Local de Trabalho</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="Ex: Empresa XYZ / Autônomo"
                                value={resp.comercialEmpresa || ''}
                                onChange={e => handleInputChange('comercialEmpresa', e.target.value, index)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Telefone Comercial</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="(00) 0000-0000"
                                value={resp.comercialTelefone || ''}
                                onChange={e => handleInputChange('comercialTelefone', formatPhone(e.target.value), index)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>CEP Comercial</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="00000-000"
                                value={resp.comercialCep || ''}
                                onChange={e => handleCepComercialChange(e.target.value, index)}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 160px', gap: 12, marginBottom: 12 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Endereço Comercial / Logradouro</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="Rua, Avenida, Bloco empresarial..."
                                value={resp.comercialEndereco || ''}
                                onChange={e => handleInputChange('comercialEndereco', e.target.value, index)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Número</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="Nº"
                                value={resp.comercialNumero || ''}
                                onChange={e => handleInputChange('comercialNumero', e.target.value, index)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Complemento / Sala</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="Sala, Andar, Galpão..."
                                value={resp.comercialComplemento || ''}
                                onChange={e => handleInputChange('comercialComplemento', e.target.value, index)}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 90px', gap: 12 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Bairro</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="Bairro"
                                value={resp.comercialBairro || ''}
                                onChange={e => handleInputChange('comercialBairro', e.target.value, index)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>Cidade</label>
                              <input
                                className="form-input"
                                style={{ height: 40, padding: '0 12px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                placeholder="Cidade"
                                value={resp.comercialCidade || ''}
                                onChange={e => handleInputChange('comercialCidade', e.target.value, index)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 5 }}>UF</label>
                              <select
                                className="form-input"
                                style={{ height: 40, padding: '0 8px', fontSize: 13, borderRadius: 8, boxSizing: 'border-box' }}
                                value={resp.comercialUf || ''}
                                onChange={e => handleInputChange('comercialUf', e.target.value, index)}
                              >
                                <option value="">UF...</option>
                                {ESTADOS_BRASIL.map(uf => (
                                  <option key={uf} value={uf}>{uf}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
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
                              handleInputChange('diasAcesso', newDias, index);
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
                        onClick={() => handleInputChange('proibido', !resp.proibido, index)}
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

                  {/* Vínculo com Alunos */}
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Vincular Alunos (Pesquise por nome)</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        className="form-input"
                        style={{ paddingLeft: 36 }}
                        placeholder="Digite o nome do aluno..."
                        value={buscaAluno}
                        onChange={e => setBuscaAluno(e.target.value)}
                      />
                      {buscaAluno.length >= 3 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                          {resultadosAlunos.length === 0 ? (
                            <div style={{ padding: '12px', color: '#64748b', fontSize: 12, textAlign: 'center' }}>Nenhum aluno encontrado</div>
                          ) : (
                            resultadosAlunos.map((a: any) => (
                              <div
                                key={a.id}
                                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                onClick={() => {
                                  const current = resp.alunosVinculados || [];
                                  const currentIds = current.map((item: any) => typeof item === 'object' ? item.id : item);
                                  if (!currentIds.includes(a.id)) {
                                    handleInputChange('alunosVinculados', [...current, a], index);
                                  }
                                  setBuscaAluno('');
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                              >
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{a.nome}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Código: {a.codigo || a.id}</div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Alunos Vinculados (Apenas ID) */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {resp.alunosVinculados?.map((aluno: any) => {
                        const id = typeof aluno === 'object' ? aluno.id : aluno;
                        return (
                          <span key={id} style={{ padding: '4px 10px', background: '#ede9fe', color: '#7c3aed', borderRadius: '6px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {typeof aluno === 'object' ? `${aluno.nome} (${aluno.codigo || id})` : `ID: ${id}`}
                            <button
                              type="button"
                              onClick={() => {
                                const current = resp.alunosVinculados || [];
                                handleInputChange('alunosVinculados', current.filter((item: any) => (typeof item === 'object' ? item.id : item) !== id), index);
                              }}
                              style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )
            })}

              {!editingResponsavel && (
                <button 
                  onClick={() => setFormResponsaveis([...formResponsaveis, createEmptyResponsavel()])} 
                  style={{ 
                    width: '100%', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    border: '2px dashed #3b82f6', 
                    background: 'rgba(59, 130, 246, 0.05)',
                    color: '#3b82f6',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                >
                  <Plus size={16} /> Adicionar Outro Responsável
                </button>
              )}
            </div>

            {/* Footer do Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <button onClick={() => setIsModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', color: '#475569', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> : <Save size={14} />}
                {editingResponsavel ? 'Salvar Alterações' : 'Criar Responsável'}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
    </div>
  )
}
