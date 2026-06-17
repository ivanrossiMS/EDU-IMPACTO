'use client'

import React, { useEffect, useState } from 'react'
import { Search, UserPlus, Filter, Clock, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react'

type Funcionario = { id: string; nome: string; cpf: string; email: string; telefone: string; status: string; cargo: string; data_nascimento?: string }
type Ausencia = { id: string; funcionario_id: string; tipo: string; data_inicio: string; data_fim: string; status: string; motivo?: string }

export default function GestaoPessoasColaboradores() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/rh/funcionarios').then(res => res.ok ? res.json() : []),
      fetch('/api/rh/ausencias').then(res => res.ok ? res.json() : [])
    ]).then(([funcs, aus]) => {
      setFuncionarios(Array.isArray(funcs) ? funcs : [])
      setAusencias(Array.isArray(aus) ? aus : [])
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const filtered = funcionarios.filter(f => 
    f.nome?.toLowerCase().includes(busca.toLowerCase()) || 
    f.cpf?.includes(busca) || 
    f.cargo?.toLowerCase().includes(busca.toLowerCase())
  )

  const getAusenciasFuncionario = (id: string) => ausencias.filter(a => a.funcionario_id === id)
  const getStatusAusencia = (id: string) => {
    const aus = getAusenciasFuncionario(id)
    const hoje = new Date().toISOString().split('T')[0]
    const emAusencia = aus.find(a => a.data_inicio <= hoje && a.data_fim >= hoje && a.status !== 'recusado')
    
    if (emAusencia) {
      return (
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:100, background:'#fef3c7', color:'#d97706', fontSize:12, fontWeight:600 }}>
          <Clock size={12}/> {emAusencia.tipo} até {new Date(emAusencia.data_fim).toLocaleDateString('pt-BR')}
        </span>
      )
    }
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:100, background:'#d1fae5', color:'#059669', fontSize:12, fontWeight:600 }}>
        <CheckCircle2 size={12}/> Ativo e Trabalhando
      </span>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Colaboradores
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Base de dados unificada de funcionários, histórico de ausências e afastamentos.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Filter size={18} color="#64748b" />
            Filtrar
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            <UserPlus size={18} />
            Novo Colaborador
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }} />
        <input 
          type="text" 
          placeholder="Buscar por nome, cargo ou CPF..." 
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ 
            width: '100%', padding: '18px 20px 18px 54px', borderRadius: 16, background: '#ffffff', 
            border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 15, outline: 'none', transition: 'all 0.3s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.1)' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)' }}
        />
      </div>

      {/* Tabela */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 15 }}>Carregando dados unificados do ERP...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 15 }}>Nenhum colaborador encontrado.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Colaborador</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cargo / Setor</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status de Trabalho</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id} style={{ borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>
                        {f.nome?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{f.nome}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>CPF: {f.cpf || 'Não informado'} • E-mail: {f.email || 'Não informado'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: 14, color: '#334155', fontWeight: 600, marginBottom: 4 }}>{f.cargo || 'Não especificado'}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    {getStatusAusencia(f.id)}
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    <button style={{ padding: '8px 16px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#e2e8f0' }}>
                      Ver Dossiê
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
