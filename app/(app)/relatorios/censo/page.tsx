'use client'

import { useState } from 'react'
import { Database, CheckCircle, AlertTriangle, Clock, Download, RefreshCw, Brain, FileText } from 'lucide-react'
import { useData } from '@/lib/dataContext'

const STEPS = [
  { id: 1, label: 'Identificação da Escola', key: 'escola' },
  { id: 2, label: 'Turmas e Cursos', key: 'turmas' },
  { id: 3, label: 'Docentes e Funcionários', key: 'docentes' },
  { id: 4, label: 'Matrículas e Alunos', key: 'matriculas' },
  { id: 5, label: 'Dados Complementares', key: 'complementar' },
  { id: 6, label: 'Validação Final', key: 'validacao' },
  { id: 7, label: 'Envio ao MEC / INEP', key: 'envio' },
]

export default function CensoPage() {
  const [running, setRunning] = useState(false)
  const { alunos, turmas, funcionarios } = useData()

  const runValidation = () => { setRunning(true); setTimeout(() => setRunning(false), 2000) }

  // Real KPIs from DataContext
  const totalAlunos = alunos.length
  const totalTurmas = turmas.length
  const totalDocentes = funcionarios.length

  // Progress: steps are considered "started" only when data exists
  const stepsStatus = STEPS.map(step => {
    if (step.key === 'escola') return totalDocentes > 0 ? 'concluido' : 'pendente'
    if (step.key === 'turmas') return totalTurmas > 0 ? 'concluido' : 'pendente'
    if (step.key === 'docentes') return totalDocentes > 0 ? 'concluido' : 'pendente'
    if (step.key === 'matriculas') return totalAlunos > 0 ? (totalAlunos > 10 ? 'concluido' : 'em_andamento') : 'pendente'
    return 'pendente'
  })
  const concluidos = stepsStatus.filter(s => s === 'concluido').length
  const progresso = Math.round((concluidos / STEPS.length) * 100)

  const configYear = new Date().getFullYear()
  const prazoDate = `30/04/${configYear}`
  const diasRestantes = Math.ceil((new Date(`${configYear}-04-30`).getTime() - new Date().getTime()) / 86400000)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Censo Escolar {configYear}</h1>
          <p className="page-subtitle">INEP / Educacenso • Prazo: {prazoDate} ({diasRestantes > 0 ? `${diasRestantes} dias` : 'Prazo encerrado'})</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar XML</button>
          <button className="btn btn-primary btn-sm" onClick={runValidation} disabled={running}>
            {running ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Validando...</> : <><Brain size={13} />Validar com IA</>}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div style={{ background: diasRestantes <= 20 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${diasRestantes <= 20 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Clock size={22} color={diasRestantes <= 20 ? '#f87171' : '#fbbf24'} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {diasRestantes <= 20 ? `⚠️ Atenção! Apenas ${diasRestantes} dias para o prazo!` : `📅 Prazo em ${diasRestantes} dias`}
          </div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>Progresso atual: {progresso}% • {concluidos}/{STEPS.length} etapas concluídas</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: diasRestantes <= 20 ? '#f87171' : '#fbbf24', fontFamily: 'Outfit, sans-serif' }}>{progresso}%</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Preenchido</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Etapas do Preenchimento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map((step, i) => {
              const status = stepsStatus[i] || 'pendente'
              const prog = status === 'concluido' ? 100 : status === 'em_andamento' ? 50 : 0
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: status === 'concluido' ? 'rgba(16,185,129,0.2)' : status === 'em_andamento' ? 'rgba(59,130,246,0.2)' : 'rgba(107,114,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {status === 'concluido' ? <CheckCircle size={14} color="#10b981" /> : status === 'em_andamento' ? <RefreshCw size={14} color="#60a5fa" /> : <Clock size={14} color="#6b7280" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: status === 'pendente' ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))', fontWeight: status === 'em_andamento' ? 700 : 400 }}>{step.id}. {step.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: status === 'concluido' ? '#34d399' : status === 'em_andamento' ? '#60a5fa' : '#6b7280' }}>{prog}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${prog}%`, background: status === 'concluido' ? '#10b981' : status === 'em_andamento' ? '#3b82f6' : '#374151' }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Resumo de Dados Reais</div>
          {[
            { label: 'Total de Alunos', value: totalAlunos, color: '#3b82f6' },
            { label: 'Turmas cadastradas', value: totalTurmas, color: '#10b981' },
            { label: 'Funcionários', value: totalDocentes, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{s.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'Outfit, sans-serif' }}>{s.value}</span>
            </div>
          ))}
          {totalAlunos === 0 && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, fontSize: 12, color: '#fbbf24' }}>
              <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />
              Cadastre alunos, turmas e funcionários para avançar no Censo.
            </div>
          )}
        </div>
      </div>

      <div className="ia-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Brain size={18} color="#a78bfa" />
          <div style={{ fontWeight: 700, fontSize: 14 }}>Análise IA — Status do Censo</div>
        </div>
        {totalAlunos === 0 && totalTurmas === 0 ? (
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
            Nenhum dado cadastrado no sistema. Cadastre alunos, turmas e funcionários para que a IA possa analisar a conformidade do Censo Escolar.
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
            ✅ {totalAlunos} aluno(s) e {totalTurmas} turma(s) identificados. Continue preenchendo os dados complementares para atingir 100% de conformidade antes do prazo.
          </div>
        )}
      </div>
    </div>
  )
}
