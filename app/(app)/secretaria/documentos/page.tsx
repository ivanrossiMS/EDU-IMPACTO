'use client'

import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useData } from '@/lib/dataContext'
import { useState, useEffect } from 'react'
import { FileText, Search, Plus, FileCheck, Download, CheckCircle, Clock, Trash2, Printer } from 'lucide-react'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'

interface DocumentoEmitido {
  id: string
  aluno_id: string
  documento_tipo: string
  data_emissao: string
  emitido_por?: string
}

export default function SecretariaPage() {
  const [alunos] = useSupabaseArray<any>('alunos')
  const [search, setSearch] = useState('')
  const [alunoSel, setAlunoSel] = useState('')
  const queryClient = useQueryClient()
  const { logSystemAction } = useData()

  const filtered = (alunos || []).filter(a =>
    a.nome.toLowerCase().includes(search.toLowerCase()) ||
    a.matricula.includes(search)
  )

  const DOCUMENTOS_TIPOS = [
    { icon: '📋', label: 'Declaração de Matrícula', desc: 'Comprova matrícula do aluno no período indicado' },
    { icon: '📅', label: 'Declaração de Frequência', desc: 'Comprova frequência escolar para fins externos' },
    { icon: '📚', label: 'Histórico Escolar', desc: 'Histórico completo de notas e progressão' },
    { icon: '✅', label: 'Atestado de Escolaridade', desc: 'Comprova nível de escolaridade atual' },
    { icon: '📊', label: 'Boletim Escolar', desc: 'Notas e frequência por bimestre' },
    { icon: '🔄', label: 'Declaração de Transferência', desc: 'Para transferências entre escolas' },
  ]

  const alunoSelecionado = (alunos || []).find(a => a.id === alunoSel)

  // Query para buscar histórico de documentos (Cache via React Query)
  const { data: historico = [], isLoading: loadingHist, refetch: fetchHistorico } = useApiQuery<DocumentoEmitido[]>(
    ['documentos'],
    '/api/documentos'
  )

  const handleEmitir = async (tipo: string) => {
    if (!alunoSel) return

    try {
      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aluno_id: alunoSel,
          documento_tipo: tipo,
          emitido_por: 'Secretaria' // Aqui poderia ser o nome do usuário logado
        })
      })

      if (res.ok) {
        logSystemAction(
          'Secretaria (Documentos)',
          'Emissão',
          `Emissão do documento "${tipo}" para o aluno ${alunoSelecionado?.nome}`,
          { registroId: alunoSel, detalhesDepois: { tipo, aluno_id: alunoSel } }
        )
        alert(`Documento "${tipo}" emitido com sucesso para ${alunoSelecionado?.nome}!`)
        queryClient.invalidateQueries({ queryKey: ['documentos'] })
        // Aqui simularia o download do PDF
      } else {
        alert('Erro ao registrar emissão.')
      }
    } catch (error) {
      console.error('Erro ao emitir documento:', error)
    }
  }


  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Secretaria</span>
          </div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Secretaria Digital</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Documentos, declarações, atestados e protocolos.</p>
        </div>
        <button style={{ height: '44px', padding: '0 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Novo Protocolo
        </button>
      </div>

      {/* Seleção de aluno */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: '16px' }}>Selecionar Aluno para Emitir Documento</div>
        
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            className="form-input" 
            style={{ paddingLeft: 36, height: '48px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '14px' }}
            placeholder="Buscar aluno por nome ou matrícula..."
            value={search}
            onChange={e => { setSearch(e.target.value); setAlunoSel('') }}
          />
        </div>

        {search && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            {filtered.slice(0, 10).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', background: alunoSel === a.id ? '#eff6ff' : 'transparent', border: alunoSel === a.id ? '1px solid #bfdbfe' : '1px solid transparent' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{a.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Matrícula: {a.matricula} • Turma: {a.turma}</div>
                </div>
                <button 
                  onClick={() => { setAlunoSel(a.id); setSearch(a.nome) }}
                  style={{ height: '32px', padding: '0 12px', background: alunoSel === a.id ? '#2563eb' : '#f1f5f9', color: alunoSel === a.id ? '#fff' : '#475569', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {alunoSel === a.id ? 'Selecionado' : 'Selecionar'}
                </button>
              </div>
            ))}
          </div>
        )}

        {alunoSelecionado && (
          <div style={{ marginTop: '16px', padding: '16px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={20} style={{ color: '#2563eb' }} />
            <div>
              <span style={{ fontWeight: 700, color: '#1e3a8a' }}>Aluno Selecionado:</span>{' '}
              <span style={{ color: '#1e40af' }}>{alunoSelecionado.nome}</span>
              <span style={{ fontSize: '12px', color: '#60a5fa', marginLeft: '8px' }}>• {alunoSelecionado.turma}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tipos de documentos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {DOCUMENTOS_TIPOS.map(doc => (
          <div key={doc.label} style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  {doc.icon}
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{doc.label}</div>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>{doc.desc}</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              {alunoSelecionado ? (
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Pronto para emitir</span>
              ) : (
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Selecione um aluno</span>
              )}
              <button 
                className={`btn btn-sm ${alunoSelecionado ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ height: '32px', padding: '0 12px', background: alunoSelecionado ? '#2563eb' : '#f1f5f9', color: alunoSelecionado ? '#fff' : '#94a3b8', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: alunoSelecionado ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={!alunoSelecionado}
                onClick={() => handleEmitir(doc.label)}
              >
                <Download size={14} /> Emitir PDF
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Histórico de Documentos Emitidos */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Histórico de Documentos Emitidos</div>
          <button 
            onClick={() => fetchHistorico()}
            style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Atualizar
          </button>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Aluno</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Documento</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Data de Emissão</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Emitido Por</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingHist ? (
                <TableSkeleton rows={3} cols={5} />
              ) : historico.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Nenhum documento emitido recentemente.</td>
                </tr>
              ) : (
                historico.map(reg => {
                  const aluno = (alunos || []).find(a => a.id === reg.aluno_id)
                  return (
                    <tr key={reg.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{aluno?.nome || 'Aluno Não Encontrado'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Matrícula: {aluno?.matricula || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#0f172a' }}>{reg.documento_tipo}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} style={{ color: '#94a3b8' }} />
                          {new Date(reg.data_emissao).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{reg.emitido_por || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button 
                          style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '0 auto' }}
                          title="Reimprimir / Visualizar"
                        >
                          <Printer size={14} />
                        </button>
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
  )
}
