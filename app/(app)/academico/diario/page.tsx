'use client'

import { useState } from 'react'
import { useData } from '@/lib/dataContext'
import { ALUNOS, FREQUENCIA_TURMA } from '@/lib/data'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, XCircle, Save, Brain, Calendar, Users, Clock, AlertTriangle } from 'lucide-react'
import { getInitials } from '@/lib/utils'

const AULAS_MOCK = [
  { horario: '07:00–07:50', disciplina: 'Matemática', professor: 'Prof. Ricardo Faria', sala: 'Sala 201' },
  { horario: '07:50–08:40', disciplina: 'Matemática', professor: 'Prof. Ricardo Faria', sala: 'Sala 201' },
  { horario: '08:40–09:30', disciplina: 'Português', professor: 'Prof. André Moura', sala: 'Sala 201' },
  { horario: '09:50–10:40', disciplina: 'Ciências', professor: 'Prof. Carlos Menezes', sala: 'Sala 201' },
  { horario: '10:40–11:30', disciplina: 'História', professor: 'Prof. Carla Mota', sala: 'Sala 201' },
]

const turmaAlunos = [
  { id: 'A001', nome: 'Lucas Ferreira Santos', presente: true, frequencia: 94.2 },
  { id: 'A002', nome: 'Ana Clara Oliveira', presente: false, frequencia: 78.5 },
  { id: 'A003', nome: 'Pedro Henrique Costa', presente: true, frequencia: 96.8 },
  { id: 'A004', nome: 'Sofia Lima Rodrigues', presente: false, frequencia: 61.0 },
  { id: 'A005', nome: 'Gabriel Alves Pereira', presente: true, frequencia: 98.1 },
  { id: 'A006', nome: 'Isabella Mendes Cruz', presente: true, frequencia: 91.4 },
  { id: 'A007', nome: 'Mateus Souza Barbosa', presente: false, frequencia: 72.3 },
  { id: 'A008', nome: 'Valentina Carvalho Nunes', presente: true, frequencia: 95.6 },
]

export default function DiarioPage() {
  const { logSystemAction } = useData()
  const { data: turmas = [], isLoading } = useQuery<any[]>({
    queryKey: ['turmas'],
    queryFn: async () => { const r = await fetch('/api/turmas'); return r.json() }
  })
  
  const [selectedTurma, setSelectedTurma] = useState('9A')
  const [selectedAula, setSelectedAula] = useState(0)
  const [alunos, setAlunos] = useState(turmaAlunos.map(a => ({ ...a })))
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'frequencia' | 'notas' | 'conteudo'>('frequencia')

  const presentes = alunos.filter(a => a.presente).length
  const ausentes = alunos.filter(a => !a.presente).length
  const pct = Math.round((presentes / alunos.length) * 100)

  const togglePresenca = (id: string) => {
    setAlunos(prev => prev.map(a => a.id === id ? { ...a, presente: !a.presente } : a))
    setSaved(false)
  }

  const marcarTodos = (val: boolean) => {
    setAlunos(prev => prev.map(a => ({ ...a, presente: val })))
    setSaved(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diário Digital</h1>
          <p className="page-subtitle">Frequência, notas e conteúdo aplicado</p>
        </div>
        {!isLoading && (
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-input" style={{ width: 'auto' }} value={selectedTurma} onChange={e => setSelectedTurma(e.target.value)}>
            {turmas.map((t: any) => <option key={t.id}>{t.nome}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => {
            logSystemAction('Acadêmico (Diário)', 'Cadastro', `Salvar Diário de Frequência (Turma ${selectedTurma})`, { registroId: selectedTurma, detalhesDepois: { presentes, ausentes } })
            setSaved(true)
          }}>
            {saved ? <><CheckCircle size={13} style={{ color: '#34d399' }} />Salvo!</> : <><Save size={13} />Salvar Diário</>}
          </button>
        </div>
        )}
      </div>

      {/* Aula Selecionada */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {AULAS_MOCK.map((aula, i) => (
          <button key={i} onClick={() => setSelectedAula(i)}
            style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${selectedAula === i ? '#3b82f6' : 'hsl(var(--border-subtle))'}`, background: selectedAula === i ? 'rgba(59,130,246,0.1)' : 'hsl(var(--bg-surface))', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left', minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{aula.horario}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: selectedAula === i ? '#60a5fa' : 'hsl(var(--text-primary))', marginTop: 2 }}>{aula.disciplina}</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{aula.professor.split(' ').slice(-1)}</div>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Presentes', value: presentes, color: '#10b981', icon: '✅' },
          { label: 'Ausentes', value: ausentes, color: '#ef4444', icon: '❌' },
          { label: 'Frequência do dia', value: `${pct}%`, color: pct >= 85 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444', icon: '📊' },
          { label: 'Alertas frequência', value: alunos.filter(a => a.frequencia < 75).length, color: '#f59e0b', icon: '⚠️' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div className="tab-list" style={{ marginBottom: 16, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'frequencia' ? 'active' : ''}`} onClick={() => setTab('frequencia')}>Frequência</button>
        <button className={`tab-trigger ${tab === 'notas' ? 'active' : ''}`} onClick={() => setTab('notas')}>Notas</button>
        <button className={`tab-trigger ${tab === 'conteudo' ? 'active' : ''}`} onClick={() => setTab('conteudo')}>Conteúdo</button>
      </div>

      {tab === 'frequencia' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button className="btn btn-success btn-sm" onClick={() => marcarTodos(true)}><CheckCircle size={12} />Todos Presentes</button>
            <button className="btn btn-danger btn-sm" onClick={() => marcarTodos(false)}><XCircle size={12} />Marcar Todos Ausentes</button>
            <button className="btn btn-secondary btn-sm"><Brain size={12} />Verificar com IA</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alunos.map(aluno => (
              <div key={aluno.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: aluno.presente ? 'hsl(var(--bg-surface))' : 'rgba(239,68,68,0.04)', border: `1px solid ${aluno.presente ? 'hsl(var(--border-subtle))' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => togglePresenca(aluno.id)}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, background: aluno.presente ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: aluno.presente ? '#34d399' : '#f87171', flexShrink: 0 }}>
                  {getInitials(aluno.nome)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{aluno.nome}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Frequência geral: <span style={{ color: aluno.frequencia < 75 ? '#f87171' : '#34d399', fontWeight: 600 }}>{aluno.frequencia}%</span></div>
                </div>
                {aluno.frequencia < 75 && (
                  <AlertTriangle size={14} color="#f59e0b" />
                )}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: aluno.presente ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `2px solid ${aluno.presente ? '#10b981' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {aluno.presente ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'notas' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Lançamento de Notas — {AULAS_MOCK[selectedAula].disciplina} • Turma {selectedTurma}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alunos.map(aluno => (
              <div key={aluno.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>
                  {getInitials(aluno.nome)}
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>{aluno.nome}</div>
                <input type="number" min={0} max={10} step={0.5} placeholder="—" className="form-input" style={{ width: 80, textAlign: 'center', fontSize: 14, fontWeight: 700 }} />
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>/ 10,0</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary btn-sm">Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => {
              logSystemAction('Acadêmico (Diário)', 'Cadastro', `Salvar Notas (Turma ${selectedTurma})`, { registroId: selectedTurma })
              setSaved(true)
            }}><Save size={13} />Salvar Notas</button>
          </div>
        </div>
      )}

      {tab === 'conteudo' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Conteúdo Aplicado — {AULAS_MOCK[selectedAula].disciplina}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Tema da Aula</label>
              <input className="form-input" placeholder="Ex: Funções do 2º grau — Resolução de problemas" />
            </div>
            <div>
              <label className="form-label">Habilidades BNCC</label>
              <input className="form-input" placeholder="Ex: EF09MA01, EF09MA02" />
            </div>
            <div>
              <label className="form-label">Descrição do conteúdo</label>
              <textarea className="form-input" rows={4} placeholder="Descreva o que foi trabalhado em sala..." />
            </div>
            <div>
              <label className="form-label">Recursos utilizados</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Livro didático', 'Slides', 'Vídeo', 'Laboratório', 'Atividade impressa', 'Plataforma digital'].map(r => (
                  <button key={r} className="btn btn-secondary btn-sm">+ {r}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => {
              logSystemAction('Acadêmico (Diário)', 'Cadastro', `Salvar Conteúdo (Turma ${selectedTurma})`, { registroId: selectedTurma })
              setSaved(true)
            }}><Save size={14} />Salvar Conteúdo</button>
          </div>
        </div>
      )}
    </div>
  )
}
