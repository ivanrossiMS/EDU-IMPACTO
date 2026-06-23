'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Trash2, Edit2, Phone, Mail, Users, Filter, Download, Tag, CreditCard, X, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { UpdatingIndicator } from '@/components/skeletons/States'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import { useData } from '@/lib/dataContext'
import { formatPhone } from '@/lib/utils'

export default function ResponsaveisPage() {
  const queryClient = useQueryClient()
  const { logSystemAction } = useData()
  
  const [search, setSearch] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(10)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingResponsavel, setEditingResponsavel] = useState<any | null>(null)
  const [buscaAluno, setBuscaAluno] = useState('')
  const [resultadosAlunos, setResultadosAlunos] = useState<any[]>([])
  
  // Estado do formulário do modal
  const [formResponsaveis, setFormResponsaveis] = useState([{ 
    id: '', nome: '', dataNasc: '', 
    email: '', telefone: '', profissao: '', rfid: '', 
    parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], 
    isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false,
    alunosVinculados: [] as string[]
  }])
  const [loading, setLoading] = useState(false)

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
    setFormResponsaveis([{ 
      id: '', nome: '', dataNasc: '', 
      email: '', telefone: '', profissao: '', rfid: '', 
      parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], 
      isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false,
      alunosVinculados: []
    }])
    setIsModalOpen(true)
  }

  const handleEdit = (resp: any) => {
    setEditingResponsavel(resp)
    setFormResponsaveis([{
      id: resp.id || '',
      nome: resp.nome || '',
      dataNasc: resp.data_nasc || resp.dataNasc || '',
      email: resp.email || '',
      telefone: resp.telefone || '',
      profissao: resp.profissao || '',
      rfid: resp.rfid || '',
      parentesco: resp.alunosVinculados?.find((a: any) => a.parentesco)?.parentesco || resp.parentesco || '',
      diasAcesso: resp.dias_acesso || resp.diasAcesso || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
      isFinanceiro: resp.alunosVinculados?.some((a: any) => a.isFinanceiro) || false,
      isPedagogico: resp.alunosVinculados?.some((a: any) => a.isPedagogico) || false,
      isOutro: resp.alunosVinculados?.some((a: any) => a.isOutro) || false,
      proibido: resp.proibido === true,
      alunosVinculados: resp.alunosVinculados || resp.aluno_responsavel?.map((ar: any) => ar.aluno_id) || []
    }])
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
      setIsModalOpen(false)
      setEditingResponsavel(null)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="page-container" style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Responsáveis
            {isFetching && <UpdatingIndicator />}
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Gerenciamento de pais e responsáveis do sistema</p>
        </div>
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

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
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
        <button className="neo-btn neo-btn-secondary" style={{ gap: 8 }}>
          <Filter size={16} /> Filtros
        </button>
        <button className="neo-btn neo-btn-secondary" style={{ gap: 8 }}>
          <Download size={16} /> Exportar
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: 16, width: 'min(900px, 95vw)', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            
            {/* Header do Modal com Gradiente Escuro Ultra Moderno */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', margin: '-24px -24px 20px -24px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{editingResponsavel ? 'Editar Responsável' : 'Novo Responsável'}</h2>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Preencha os dados do responsável abaixo</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {formResponsaveis.map((resp, index) => (
                <div key={index} style={{ border: '1px solid #e2e8f0', padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Dados do Responsável #{index + 1}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleInputChange('isFinanceiro', !resp.isFinanceiro, index)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: 11,
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: resp.isFinanceiro ? '#10b981' : '#e2e8f0',
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
                        onClick={() => handleInputChange('isPedagogico', !resp.isPedagogico, index)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: 11,
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: resp.isPedagogico ? '#8b5cf6' : '#e2e8f0',
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
                        onClick={() => handleInputChange('isOutro', !resp.isOutro, index)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: 11,
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: resp.isOutro ? '#f59e0b' : '#e2e8f0',
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
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Linha 1 */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: '1', maxWidth: '100px' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>ID</label>
                        <input className="form-input" placeholder="Ex: RESP001" value={resp.id} onChange={e => handleInputChange('id', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '3.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Nome Completo *</label>
                        <input className="form-input" placeholder="Nome do responsável" value={resp.nome} onChange={e => handleInputChange('nome', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '1.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Parentesco *</label>
                        <select className="form-input" value={resp.parentesco} onChange={e => handleInputChange('parentesco', e.target.value, index)}>
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
                        <input type="date" className="form-input" value={resp.dataNasc} onChange={e => handleInputChange('dataNasc', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '2.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>E-mail *</label>
                        <input type="email" className="form-input" placeholder="email@exemplo.com" value={resp.email} onChange={e => handleInputChange('email', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '1.5' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Telefone *</label>
                        <input className="form-input" placeholder="(00)00000-0000" value={resp.telefone} onChange={e => handleInputChange('telefone', formatPhone(e.target.value), index)} />
                      </div>
                    </div>

                    {/* Linha 3 */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: '2' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Profissão</label>
                        <input className="form-input" placeholder="Ex: Professor" value={resp.profissao} onChange={e => handleInputChange('profissao', e.target.value, index)} />
                      </div>
                      <div style={{ flex: '2' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Cartão RFID</label>
                        <div style={{ position: 'relative' }}>
                          <CreditCard size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Aproxime o cartão…" value={resp.rfid} onChange={e => handleInputChange('rfid', e.target.value, index)} />
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
              ))}

              {!editingResponsavel && (
                <button 
                  onClick={() => setFormResponsaveis([...formResponsaveis, { id: '', nome: '', dataNasc: '', email: '', telefone: '', profissao: '', rfid: '', parentesco: '', diasAcesso: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], isFinanceiro: false, isPedagogico: false, isOutro: false, proibido: false, alunosVinculados: [] }])} 
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
