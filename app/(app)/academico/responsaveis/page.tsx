'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { 
  Plus, Search, Trash2, Edit2, Phone, Mail, Users, Filter, Download, 
  Tag, CreditCard, X, Save, Loader2, ChevronLeft, ChevronRight,
  MapPin, Briefcase, Check, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Copy,
  UserCheck, UserX, Sparkles
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
    const newResp = createEmptyResponsavel()
    newResp.id = Math.floor(1000000 + Math.random() * 9000000).toString()
    setFormResponsaveis([newResp])
    setValidationErrors([])
    setBuscaAluno('')
    setResultadosAlunos([])
    setIsModalOpen(true)
  }

  const handleEdit = (resp: any) => {
    setEditingResponsavel(resp)
    const d = resp.dados || {}
    setFormResponsaveis([{
      id: resp.id || resp.codigo || '',
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
    setValidationErrors([])
    setBuscaAluno('')
    setResultadosAlunos([])
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
    // Validação de campos obrigatórios: ID, Nome, Parentesco, Tipo e E-mail (se Financeiro)
    const errors: { field: string; message: string }[] = []
    formResponsaveis.forEach((resp, idx) => {
      if (!resp.id || !String(resp.id).trim()) {
        errors.push({ field: `resp_${idx}_id`, message: 'ID/Código é obrigatório' })
      }
      if (!resp.nome || !resp.nome.trim()) {
        errors.push({ field: `resp_${idx}_nome`, message: 'Nome Completo é obrigatório' })
      }
      if (!resp.parentesco || !resp.parentesco.trim()) {
        errors.push({ field: `resp_${idx}_parentesco`, message: 'Parentesco é obrigatório' })
      }
      if (!resp.isFinanceiro && !resp.isPedagogico && !resp.isOutro && resp.parentesco !== 'outro') {
        errors.push({ field: `resp_${idx}_tipo`, message: 'Selecione ao menos um tipo de responsável' })
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
        alunos_vinculados: (resp.alunosVinculados || []).map((aluno: any) => ({
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
                      {resp.proibido ? 'Retirada Proibida' : 'Retirada Liberada'}
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

      {/* Modal Idêntico ao de Alunos Passo Responsável com Design Compacto de Luxo */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div 
            className="glass-card ultra-modal modal-enter-active" 
            style={{ 
              width: '100%', 
              maxWidth: 840, 
              maxHeight: '92vh', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05)'
            }}
          >
            
            {/* Header do Modal com Gradiente Luxo */}
            <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={17} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                    {editingResponsavel ? 'Editar Responsável' : 'Cadastrar Novo Responsável'}
                  </h2>
                  <p style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.85)', margin: 0 }}>
                    {editingResponsavel ? 'Atualize as informações cadastrais do responsável' : 'Preencha os dados essenciais para adicionar ao sistema'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {formResponsaveis.map((resp, index) => (
                <div 
                  key={index} 
                  style={{ 
                    border: hasError(`resp_${index}_tipo`) || hasError(`resp_${index}_id`) || hasError(`resp_${index}_nome`) || hasError(`resp_${index}_parentesco`) || hasError(`resp_${index}_email`)
                      ? '1.5px solid #ef4444' 
                      : '1px solid #e2e8f0', 
                    padding: '12px 14px', 
                    borderRadius: 10, 
                    background: '#ffffff', 
                    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  {/* Cabeçalho do Card: Identificação + Seleção de Tipos */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>
                        <Users size={12} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                            {formResponsaveis.length > 1 ? `Responsável #${index + 1}` : 'Dados do Responsável'}
                          </h3>
                        </div>
                        <p style={{ fontSize: 10.5, color: '#64748b', margin: '1px 0 0 0' }}>
                          {resp.nome?.trim() ? resp.nome : 'Preencha os dados do responsável'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Chip Financeiro */}
                      <button
                        type="button"
                        onClick={() => {
                          const val = !resp.isFinanceiro;
                          handleInputChange('isFinanceiro', val, index);
                          if (val || resp.isPedagogico || resp.isOutro) {
                            setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_tipo`));
                          }
                          if (!val) {
                            setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`));
                          }
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '14px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: resp.isFinanceiro ? '#10b981' : hasError(`resp_${index}_tipo`) ? '#ef4444' : '#e2e8f0',
                          background: resp.isFinanceiro ? '#ecfdf5' : '#f8fafc',
                          color: resp.isFinanceiro ? '#059669' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {resp.isFinanceiro && <Check size={11} />} Financeiro
                      </button>

                      {/* Chip Pedagógico */}
                      <button
                        type="button"
                        onClick={() => {
                          const val = !resp.isPedagogico;
                          handleInputChange('isPedagogico', val, index);
                          if (val || resp.isFinanceiro || resp.isOutro) {
                            setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_tipo`));
                          }
                          if (!resp.isFinanceiro) {
                            setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`));
                          }
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '14px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: resp.isPedagogico ? '#6366f1' : hasError(`resp_${index}_tipo`) ? '#ef4444' : '#e2e8f0',
                          background: resp.isPedagogico ? '#eef2ff' : '#f8fafc',
                          color: resp.isPedagogico ? '#4f46e5' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {resp.isPedagogico && <Check size={11} />} Pedagógico
                      </button>

                      {/* Chip Outro */}
                      <button
                        type="button"
                        onClick={() => {
                          const val = !resp.isOutro;
                          handleInputChange('isOutro', val, index);
                          if (val || resp.isFinanceiro || resp.isPedagogico) {
                            setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_tipo`));
                          }
                          if (!resp.isFinanceiro) {
                            setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`));
                          }
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '14px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: resp.isOutro ? '#f59e0b' : hasError(`resp_${index}_tipo`) ? '#ef4444' : '#e2e8f0',
                          background: resp.isOutro ? '#fffbeb' : '#f8fafc',
                          color: resp.isOutro ? '#d97706' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {resp.isOutro && <Check size={11} />} Outro
                      </button>

                      {formResponsaveis.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormResponsaveis(prev => prev.filter((_, i) => i !== index));
                          }}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '6px',
                            border: '1px solid #fee2e2',
                            background: '#fef2f2',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: 2
                          }}
                          title="Remover este responsável"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alerta se nenhum tipo selecionado */}
                  {!resp.isFinanceiro && !resp.isPedagogico && !resp.isOutro && resp.parentesco !== 'outro' && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <AlertTriangle size={12} /> Selecione o tipo deste responsável: Financeiro, Pedagógico ou Outro *
                      </span>
                    </div>
                  )}

                  {/* Campos do Responsável */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Linha 1: ID, Nome Completo *, Parentesco */}
                    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, whiteSpace: 'nowrap' }}>
                          ID / Código <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <input 
                            className="form-input" 
                            style={{ 
                              flex: 1, 
                              height: 32, 
                              padding: '0 8px', 
                              fontSize: 12, 
                              borderRadius: 6, 
                              fontWeight: 700, 
                              background: '#fff',
                              ...getMandatoryFieldStyle(resp.id, `resp_${index}_id`)
                            }}
                            placeholder="Ex: 7892255" 
                            value={resp.id || ''} 
                            onChange={e => {
                              handleInputChange('id', e.target.value, index);
                              if (hasError(`resp_${index}_id`)) {
                                setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_id`));
                              }
                            }} 
                          />
                          {!editingResponsavel && (
                            <button
                              type="button"
                              onClick={() => {
                                const rand = Math.floor(1000000 + Math.random() * 9000000).toString();
                                handleInputChange('id', rand, index);
                              }}
                              style={{
                                height: 32,
                                padding: '0 8px',
                                borderRadius: 6,
                                background: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s ease'
                              }}
                              title="Gerar ID automático"
                            >
                              <Sparkles size={11} /> Auto
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, whiteSpace: 'nowrap' }}>
                          Nome Completo <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input 
                          className="form-input" 
                          style={{ 
                            ...getMandatoryFieldStyle(resp.nome, `resp_${index}_nome`), 
                            height: 32, 
                            padding: '0 10px', 
                            fontSize: 12.5, 
                            borderRadius: 6, 
                            fontWeight: 600, 
                            background: '#fff' 
                          }}
                          placeholder="Nome completo do responsável" 
                          value={resp.nome || ''} 
                          onChange={e => {
                            handleInputChange('nome', e.target.value, index);
                            if (hasError(`resp_${index}_nome`)) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_nome`));
                            }
                          }} 
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, whiteSpace: 'nowrap' }}>
                          Parentesco / Vínculo <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select 
                          className="form-input" 
                          style={{ 
                            ...getMandatoryFieldStyle(resp.parentesco, `resp_${index}_parentesco`), 
                            height: 32, 
                            padding: '0 8px', 
                            fontSize: 12, 
                            borderRadius: 6, 
                            fontWeight: 600, 
                            background: '#fff' 
                          }}
                          value={resp.parentesco || ''} 
                          onChange={e => {
                            handleInputChange('parentesco', e.target.value, index);
                            if (hasError(`resp_${index}_parentesco`)) {
                              setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_parentesco`));
                            }
                          }}
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

                    {/* Linha 2: WhatsApp, E-mail, Cartão RFID */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, whiteSpace: 'nowrap' }}>
                          WhatsApp / Celular
                        </label>
                        <div style={{ position: 'relative' }}>
                          <Phone size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input 
                            className="form-input" 
                            style={{ width: '100%', height: 32, paddingLeft: 28, paddingRight: 8, fontSize: 12, borderRadius: 6, background: '#fff' }}
                            placeholder="(00) 00000-0000" 
                            value={resp.telefone || ''} 
                            onChange={e => handleInputChange('telefone', formatPhone(e.target.value), index)} 
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, whiteSpace: 'nowrap' }}>
                          E-mail {resp.isFinanceiro ? <span style={{ color: '#ef4444' }}>*</span> : ''}
                        </label>
                        <div style={{ position: 'relative' }}>
                          <Mail size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
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
                                      background: '#fff5f5',
                                      transition: 'all 0.2s ease-in-out'
                                    }
                                  : {}), 
                              width: '100%',
                              height: 32, 
                              paddingLeft: 28, 
                              paddingRight: 8, 
                              fontSize: 12, 
                              borderRadius: 6, 
                              background: '#fff' 
                            }}
                            placeholder="email@exemplo.com" 
                            value={resp.email || ''} 
                            onChange={e => {
                              handleInputChange('email', e.target.value, index);
                              if (hasError(`resp_${index}_email`)) {
                                setValidationErrors(prev => prev.filter(err => err.field !== `resp_${index}_email`));
                              }
                            }} 
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, whiteSpace: 'nowrap' }}>
                          Cartão RFID
                        </label>
                        <div style={{ position: 'relative' }}>
                          <CreditCard size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input 
                            className="form-input" 
                            style={{ width: '100%', height: 32, paddingLeft: 28, paddingRight: 8, fontSize: 12, borderRadius: 6, background: '#fff' }} 
                            placeholder="Aproxime o cartão…" 
                            value={resp.rfid || ''} 
                            onChange={e => handleInputChange('rfid', e.target.value, index)} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 3: Vincular Alunos (Pesquise por nome) */}
                    <div style={{ 
                      background: '#f8fafc', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 8, 
                      padding: '8px 10px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 6 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Tag size={11} color="#2563eb" /> Vincular Alunos (Pesquise por nome)
                        </label>
                        {resp.alunosVinculados?.length > 0 && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#2563eb', background: '#eff6ff', border: '1px solid #dbeafe', padding: '1px 6px', borderRadius: 4 }}>
                            {resp.alunosVinculados.length} {resp.alunosVinculados.length === 1 ? 'aluno vinculado' : 'alunos vinculados'}
                          </span>
                        )}
                      </div>

                      <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          className="form-input"
                          style={{ height: 32, paddingLeft: 28, paddingRight: buscaAluno ? 28 : 8, fontSize: 12, borderRadius: 6, background: '#fff' }}
                          placeholder="Digite ao menos 3 letras para pesquisar o aluno..."
                          value={buscaAluno}
                          onChange={e => setBuscaAluno(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') {
                              setBuscaAluno('')
                              setResultadosAlunos([])
                            }
                          }}
                        />
                        {buscaAluno && (
                          <button
                            type="button"
                            onClick={() => {
                              setBuscaAluno('')
                              setResultadosAlunos([])
                            }}
                            style={{
                              position: 'absolute',
                              right: 6,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: '#f1f5f9',
                              border: 'none',
                              borderRadius: '50%',
                              width: 20,
                              height: 20,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                            title="Fechar busca de aluno"
                          >
                            <X size={11} />
                          </button>
                        )}

                        {buscaAluno.length >= 3 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 50, maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
                            {/* Barra Fixa de Cabeçalho com Botão Fechar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 2 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>
                                {resultadosAlunos.length} {resultadosAlunos.length === 1 ? 'aluno encontrado' : 'alunos encontrados'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setBuscaAluno('')
                                  setResultadosAlunos([])
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: '#dc2626',
                                  background: '#fee2e2',
                                  border: '1px solid #fecaca',
                                  borderRadius: 5,
                                  padding: '2px 8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Fechar resultados da busca"
                              >
                                <X size={11} /> Fechar
                              </button>
                            </div>

                            {resultadosAlunos.length === 0 ? (
                              <div style={{ padding: '12px', color: '#64748b', fontSize: 11.5, textAlign: 'center' }}>
                                Nenhum aluno encontrado com o nome digitado.
                              </div>
                            ) : (
                              resultadosAlunos.map((a: any) => (
                                <div
                                  key={a.id}
                                  style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s' }}
                                  onClick={() => {
                                    const current = resp.alunosVinculados || [];
                                    const currentIds = current.map((item: any) => typeof item === 'object' ? item.id : item);
                                    if (!currentIds.includes(a.id)) {
                                      handleInputChange('alunosVinculados', [...current, a], index);
                                    }
                                    setBuscaAluno('');
                                    setResultadosAlunos([]);
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{a.nome}</div>
                                  <div style={{ fontSize: 10.5, color: '#64748b' }}>Matrícula: {a.codigo || a.id}</div>
                                </div>
                              ))
                            )}

                            {/* Rodapé da lista com opção de cancelar vínculo */}
                            {resultadosAlunos.length > 0 && (
                              <div style={{ padding: '5px 10px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', position: 'sticky', bottom: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBuscaAluno('')
                                    setResultadosAlunos([])
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: '#64748b',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px 4px'
                                  }}
                                >
                                  Não vincular nenhum aluno (Fechar)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Badges de Alunos Vinculados */}
                      {resp.alunosVinculados && resp.alunosVinculados.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                          {resp.alunosVinculados.map((aluno: any) => {
                            const id = typeof aluno === 'object' ? aluno.id : aluno;
                            const nome = typeof aluno === 'object' ? aluno.nome : `Aluno #${id}`;
                            const codigo = typeof aluno === 'object' ? (aluno.codigo || id) : id;
                            return (
                              <span key={id} style={{ padding: '3px 8px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span>{nome} ({codigo})</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = resp.alunosVinculados || [];
                                    handleInputChange('alunosVinculados', current.filter((item: any) => (typeof item === 'object' ? item.id : item) !== id), index);
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#6d28d9', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                  title="Desvincular aluno"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Seção Inferior: Dias Permitidos & Retirada Liberada/Proibida */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      flexWrap: 'wrap', 
                      gap: 10, 
                      padding: '8px 12px', 
                      background: '#f8fafc', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 8 
                    }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
                          Dias Permitidos para Retirada (RFID)
                        </label>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
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
                                  width: 28,
                                  height: 28,
                                  borderRadius: '6px',
                                  border: '1px solid',
                                  borderColor: showAsSelected ? '#10b981' : '#e2e8f0',
                                  background: showAsSelected ? '#10b981' : '#fff',
                                  color: showAsSelected ? '#fff' : '#64748b',
                                  fontWeight: 700,
                                  fontSize: 10.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: resp.proibido ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: showAsSelected ? '0 1px 4px rgba(16, 185, 129, 0.2)' : 'none',
                                  opacity: resp.proibido ? 0.6 : 1
                                }}
                              >
                                {dia.substring(0, 1)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleInputChange('proibido', !resp.proibido, index)}
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: '16px',
                            fontSize: 11,
                            fontWeight: 700,
                            border: '1px solid',
                            borderColor: resp.proibido ? '#ef4444' : '#10b981',
                            background: resp.proibido ? '#ef4444' : '#10b981',
                            color: '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: resp.proibido 
                              ? '0 1px 4px rgba(239, 68, 68, 0.25)' 
                              : '0 1px 4px rgba(16, 185, 129, 0.25)'
                          }}
                        >
                          {resp.proibido ? (
                            <>
                              <UserX size={13} /> Retirada Proibida
                            </>
                          ) : (
                            <>
                              <UserCheck size={13} /> Retirada Liberada
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {!editingResponsavel && (
                <button 
                  type="button"
                  onClick={() => {
                    const newResp = createEmptyResponsavel();
                    newResp.id = Math.floor(1000000 + Math.random() * 9000000).toString();
                    setFormResponsaveis(prev => [...prev, newResp]);
                  }} 
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '8px', 
                    border: '1px dashed #3b82f6', 
                    background: 'rgba(59, 130, 246, 0.04)',
                    color: '#2563eb',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)'}
                >
                  <Plus size={14} /> Adicionar Outro Responsável
                </button>
              )}
            </div>

            {/* Footer do Modal */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#fafbfc', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setIsModalOpen(false)} className="neo-btn neo-btn-secondary" style={{ height: 34, padding: '0 16px', fontSize: 12, borderRadius: 8 }}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="neo-btn neo-btn-primary"
                style={{
                  height: 34,
                  padding: '0 18px',
                  fontSize: 12,
                  borderRadius: 8,
                  background: loading ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                }}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> : <Check size={14} />}
                {editingResponsavel ? 'Salvar Alterações' : 'Finalizar Cadastro'}
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
