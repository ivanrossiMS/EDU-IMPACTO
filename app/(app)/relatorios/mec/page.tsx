'use client'

import { useState } from 'react'
import { Brain, Download, CheckCircle, Clock, AlertTriangle, Upload } from 'lucide-react'
import { useData } from '@/lib/dataContext'

const RELATORIOS_FIXOS = [
  { nome: 'Sinopse Estatística', desc: 'Indicadores educacionais do INEP', icon: '📊', prazo: '30/06/2026' },
  { nome: 'Resultado IDEB', desc: 'Índice de Desenvolvimento da Educação Básica', icon: '🏆', prazo: '31/08/2026' },
  { nome: 'PROVA BRASIL / SAEB', desc: 'Dados da avaliação em larga escala', icon: '📝', prazo: '15/07/2026' },
  { nome: 'Relatório PNLD', desc: 'Programa Nacional do Livro Didático', icon: '📚', prazo: '28/02/2027' },
]

const ETAPAS_FIXAS = [
  { id: 1, nome: 'Dados Cadastrais', descricao: 'Escola, CNPJ, INEP, endereço', key: 'mantenedor' },
  { id: 2, nome: 'Turmas e Matrículas — EF1', descricao: '1º ao 5º ano', key: 'turmas' },
  { id: 3, nome: 'Turmas e Matrículas — EF2', descricao: '6º ao 9º ano', key: 'turmas2' },
  { id: 4, nome: 'Turmas e Matrículas — EM', descricao: '1º ao 3º ano do Ensino Médio', key: 'em' },
  { id: 5, nome: 'Docentes e Funções', descricao: 'CPFs, habilitações, vínculos', key: 'docentes' },
  { id: 6, nome: 'Infraestrutura e Recursos', descricao: 'Salas, laboratórios, bibliotecas', key: 'infra' },
  { id: 7, nome: 'Validação e Envio MEC', descricao: 'Arquivo XML gerado e transmitido', key: 'envio' },
]

export default function RelatoriosMecPage() {
  const [tab, setTab] = useState<'censo' | 'relatorios' | 'historico'>('censo')
  const { alunos, turmas, funcionarios } = useData()

  const statusOf = (key: string): 'concluido' | 'em_andamento' | 'pendente' => {
    if (key === 'mantenedor') return funcionarios.length > 0 ? 'concluido' : 'pendente'
    if (key === 'turmas' || key === 'turmas2') return turmas.length > 0 ? 'concluido' : 'pendente'
    if (key === 'docentes') return funcionarios.length > 0 ? 'concluido' : 'pendente'
    if (key === 'em') return alunos.length > 5 ? 'em_andamento' : 'pendente'
    return 'pendente'
  }

  const etapasComStatus = ETAPAS_FIXAS.map(e => ({ ...e, status: statusOf(e.key) }))
  const totalItens = etapasComStatus.length
  const totalConcluidos = etapasComStatus.filter(e => e.status === 'concluido').length
  const pctGlobal = Math.round((totalConcluidos / totalItens) * 100)

  const statusMap = {
    concluido: { color: '#10b981', badge: 'badge-success', icon: <CheckCircle size={14} /> },
    em_andamento: { color: '#3b82f6', badge: 'badge-primary', icon: <Clock size={14} /> },
    pendente: { color: '#f59e0b', badge: 'badge-warning', icon: <AlertTriangle size={14} /> },
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📑 Relatórios MEC / INEP</h1>
          <p className="page-subtitle">Conectado com EDUCACENSO — Ano Base {new Date().getFullYear()}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Brain size={13} />Validar com IA</button>
          <button className="btn btn-primary btn-sm"><Upload size={13} />Transmitir ao MEC</button>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Progresso do Censo Escolar {new Date().getFullYear()}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Prazo: 30/04/{new Date().getFullYear()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: pctGlobal > 80 ? '#10b981' : '#f59e0b' }}>{pctGlobal}%</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{totalConcluidos}/{totalItens} etapas</div>
          </div>
        </div>
        <div className="progress-bar" style={{ height: 12 }}>
          <div className="progress-fill" style={{ width: `${pctGlobal}%`, background: pctGlobal > 80 ? '#10b981' : '#f59e0b', borderRadius: 100 }} />
        </div>
      </div>

      <div className="tab-list" style={{ marginBottom: 16, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'censo' ? 'active' : ''}`} onClick={() => setTab('censo')}>Censo Escolar</button>
        <button className={`tab-trigger ${tab === 'relatorios' ? 'active' : ''}`} onClick={() => setTab('relatorios')}>Relatórios MEC</button>
        <button className={`tab-trigger ${tab === 'historico' ? 'active' : ''}`} onClick={() => setTab('historico')}>Histórico Transmissões</button>
      </div>

      {tab === 'censo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {etapasComStatus.map(etapa => {
            const cfg = statusMap[etapa.status]
            const pct = etapa.status === 'concluido' ? 100 : etapa.status === 'em_andamento' ? 50 : 0
            return (
              <div key={etapa.id} className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{etapa.id}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{etapa.nome}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{etapa.descricao}</div>
                    </div>
                    <span className={`badge ${cfg.badge}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {cfg.icon}{etapa.status === 'concluido' ? 'Concluído' : etapa.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, flexShrink: 0 }}>{etapa.status === 'concluido' ? 'Revisar' : 'Completar'}</button>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'relatorios' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {RELATORIOS_FIXOS.map(r => (
            <div key={r.nome} className="card" style={{ padding: '20px', display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.nome}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>{r.desc}</div>
                <div style={{ fontSize: 11, color: '#fbbf24' }}>Prazo: {r.prazo}</div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}><Download size={11} />Baixar</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'historico' && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Nenhuma transmissão registrada</div>
          <div style={{ fontSize: 13 }}>O histórico de transmissões ao MEC aparecerá aqui após o envio.</div>
        </div>
      )}
    </div>
  )
}
