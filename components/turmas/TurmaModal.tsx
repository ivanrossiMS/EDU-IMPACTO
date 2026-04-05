'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useData, Turma, newId } from '@/lib/dataContext'
import {
  X, Check, Users, BookOpen, Clock, DollarSign, Settings,
  Plus, Trash2, Search, UserPlus, AlertCircle, ChevronDown
} from 'lucide-react'

const SEGMENTOS = ['EI', 'EF1', 'EF2', 'EM', 'EJA']
const TURNOS = ['Manha', 'Tarde', 'Noite', 'Integral']
const DIAS = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']
const SEG_COLORS: Record<string, string> = {
  EI: '#10b981', EF1: '#3b82f6', EF2: '#8b5cf6', EM: '#f59e0b', EJA: '#ec4899',
}
const ANOATUAL = new Date().getFullYear()

// Gera código: segmento + 3 dígitos + inicial do turno. Ex: "EF1-427M"
const gerarCodigoTurma = (serie: string, turno: string): string => {
  const num = String(Math.floor(100 + Math.random() * 900))
  const t = turno.charAt(0).toUpperCase()
  return `${serie}-${num}${t}`
}

interface SlotHorario {
  id: string; dia: string; horaInicio: string; horaFim: string
  disciplina: string; professor: string
}

interface DisciplinaTurma {
  id: string; nome: string; professor: string; cargaHoraria: number; codigo: string
}

type Aba = 'geral' | 'alunos' | 'disciplinas' | 'horarios' | 'financeiro'

const ABAS: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'geral',       label: 'Dados Gerais',   icon: Settings },
  { id: 'alunos',     label: 'Alunos',          icon: Users },
  { id: 'disciplinas',label: 'Disciplinas',     icon: BookOpen },
  { id: 'horarios',   label: 'Horarios',        icon: Clock },
  { id: 'financeiro', label: 'Financeiro',      icon: DollarSign },
]

function OccupancyBar({ mat, cap }: { mat: number; cap: number }) {
  const pct = cap > 0 ? Math.round((mat / cap) * 100) : 0
  const color = pct >= 100 ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#10b981'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'hsl(var(--bg-overlay))' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 60 }}>{mat}/{cap} ({pct}%)</span>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  editingId: string | null
}

export default function TurmaModal({ open, onClose, editingId }: Props) {
  const { turmas, setTurmas, alunos, setAlunos, cfgDisciplinas, funcionarios, cfgPadroesPagamento, mantenedores, logSystemAction } = useData()
  const queryClient = useQueryClient()

  // Unidades reais cadastradas no sistema
  const unidadesList = mantenedores.flatMap(m => m.unidades ?? []).map(u => u.nomeFantasia || u.razaoSocial).filter(Boolean)
  const [aba, setAba] = useState<Aba>('geral')
  const [searchAluno, setSearchAluno] = useState('')
  const [disciplinas, setDisciplinas] = useState<DisciplinaTurma[]>([])
  const [horarios, setHorarios] = useState<SlotHorario[]>([])
  const [addHorario, setAddHorario] = useState(false)
  const [slotForm, setSlotForm] = useState({ dia: 'Segunda', horaInicio: '07:00', horaFim: '08:00', disciplina: '', professor: '' })
  const [addDisciplina, setAddDisciplina] = useState(false)
  const [discForm, setDiscForm] = useState({ nome: '', professor: '', cargaHoraria: 2, codigo: '' })
  const [padraoPagamentoIds, setPadraoPagamentoIds] = useState<string[]>([])

  const editing = editingId ? turmas.find(t => t.id === editingId) : null

  const [form, setForm] = useState<Omit<Turma, 'id'>>({
    codigo: '', nome: '', serie: 'EF1', turno: 'Manha', professor: '',
    sala: '', capacidade: 35, matriculados: 0,
    unidade: '', ano: ANOATUAL,
  })

  useEffect(() => {
    if (!open) return
    setAba('geral')
    setSearchAluno('')
    if (editing) {
      setForm({ codigo: editing.codigo || gerarCodigoTurma(editing.serie, editing.turno), nome: editing.nome, serie: editing.serie, turno: editing.turno, professor: editing.professor, sala: editing.sala, capacidade: editing.capacidade, matriculados: editing.matriculados, unidade: editing.unidade, ano: editing.ano })
      // Suporte a migração: se tiver padraoPagamentoId (singular), converte para lista
      const ids = (editing as any).padraoPagamentoIds || ((editing as any).padraoPagamentoId ? [(editing as any).padraoPagamentoId] : [])
      setPadraoPagamentoIds(ids)
    } else {
      setForm({ codigo: '', nome: '', serie: 'EF1', turno: 'Manha', professor: '', sala: '', capacidade: 35, matriculados: 0, unidade: '', ano: ANOATUAL })
      setDisciplinas([]); setHorarios([])
      setPadraoPagamentoIds([])
    }
  }, [open, editingId])

  const set = (k: keyof Omit<Turma, 'id'>, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  // ── Alunos vinculados a esta turma ──────────────────────────────────────────
  // Regras sólidas:
  // 1. Só aparece nesta turma se tiver turmaId EXATO (string não-vazia) igual ao id da turma
  // 2. Status obrigatoriamente 'matriculado' (nunca 'em_cadastro' ou rascunhos)
  // 3. Nova turma (sem editingId) → lista sempre vazia (turma ainão existe)
  const turmaId = editingId ?? ''

  const alunosDaTurma = useMemo(() => {
    if (!turmaId) return [] // turma nova ainda não salva → nenhum aluno vinculado
    return alunos.filter(a => {
      const aT = a as any
      return (
        aT.turmaId === turmaId &&            // vínculo exato por ID (não por nome)
        a.status === 'matriculado'           // somente matriculados formais
      )
    })
  }, [alunos, turmaId])

  // Alunos disponíveis para adicionar manualmente — apenas matriculados sem turma
  const alunosDisponiveis = useMemo(() => {
    return alunos.filter(a => {
      const aT = a as any
      const jaNesta      = !!turmaId && aT.turmaId === turmaId
      const temOutraTurma = !!aT.turmaId && aT.turmaId !== turmaId
      return (
        !jaNesta &&
        !temOutraTurma &&
        a.status === 'matriculado' &&        // exclui 'em_cadastro' e rascunhos
        !(aT.turmaId) &&                     // sem vínculo de turma ainda
        a.nome.toLowerCase().includes(searchAluno.toLowerCase())
      )
    })
  }, [alunos, turmaId, searchAluno])

  // Matricular manualmente: vincula aluno à turma e atualiza contador
  const matricularAluno = (alunoId: string) => {
    if (!editingId) return // só opera em turmas já salvas
    const turmaNomeAtual = editing?.nome ?? form.nome
    setAlunos(prev => prev.map(a => a.id === alunoId
      ? { ...a, turma: turmaNomeAtual, serie: form.serie, turno: form.turno, turmaId: editingId, status: 'matriculado' as any }
      : a
    ))
    setTurmas(prev => prev.map(t => t.id === editingId
      ? { ...t, matriculados: (t.matriculados ?? 0) + 1 }
      : t
    ))
  }

  // Desmatricular: limpa turma e decrementa contador
  const desmatricularAluno = (alunoId: string) => {
    setAlunos(prev => prev.map(a => a.id === alunoId
      ? { ...a, turma: '', turmaId: '', serie: '', turno: '' }
      : a
    ))
    setTurmas(prev => prev.map(t => t.id === editingId
      ? { ...t, matriculados: Math.max(0, (t.matriculados ?? 1) - 1) }
      : t
    ))
  }

  // Professores disponíveis
  const professores = useMemo(() => funcionarios.filter(f => f.cargo?.toLowerCase().includes('prof') || f.departamento?.toLowerCase().includes('pedagog')), [funcionarios])

  // Disciplinas do segmento
  const disciplinasConfig = useMemo(() => cfgDisciplinas?.filter(d => d.situacao === 'ativa' && (d.niveisEnsino?.includes(form.serie) || !d.niveisEnsino?.length)) ?? [], [cfgDisciplinas, form.serie])

  const addSlot = () => {
    if (!slotForm.disciplina) return
    setHorarios(prev => [...prev, { id: newId('SL'), ...slotForm }])
    setSlotForm({ dia: 'Segunda', horaInicio: '07:00', horaFim: '08:00', disciplina: '', professor: '' })
    setAddHorario(false)
  }

  const addDisc = () => {
    if (!discForm.nome) return
    setDisciplinas(prev => [...prev, { id: newId('DT'), ...discForm }])
    setDiscForm({ nome: '', professor: '', cargaHoraria: 2, codigo: '' })
    setAddDisciplina(false)
  }

  const handleSave = () => {
    if (!form.nome.trim()) return
    const codigo = form.codigo || gerarCodigoTurma(form.serie, form.turno)
    const payload = { ...form, codigo, padraoPagamentoIds } as any
    if (editingId) {
      setTurmas(prev => prev.map(t => t.id === editingId
        ? { ...payload, id: editingId }
        : t
      ))
      fetch(`/api/turmas/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...payload, id: editingId}) })
        .then(() => queryClient.invalidateQueries({ queryKey: ['turmas'] }))
        .catch(console.error)
      logSystemAction('Acadêmico (Turmas)', 'Edição', `Atualização da turma ${payload.nome}`, { registroId: payload.codigo, nomeRelacionado: payload.nome, detalhesDepois: payload })
    } else {
      const nid = newId('T')
      setTurmas(prev => [...prev, { ...payload, id: nid }])
      fetch(`/api/turmas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...payload, id: nid}) })
        .then(() => queryClient.invalidateQueries({ queryKey: ['turmas'] }))
        .catch(console.error)
      logSystemAction('Acadêmico (Turmas)', 'Cadastro', `Criação da turma ${payload.nome}`, { registroId: payload.codigo, nomeRelacionado: payload.nome, detalhesDepois: payload })
    }
    onClose()
  }

  if (!open) return null

  const totalCargaHoraria = disciplinas.reduce((s, d) => s + d.cargaHoraria, 0)
  const vagasLivres = form.capacidade - (alunosDaTurma.length || form.matriculados)
  const padraosAtivos = cfgPadroesPagamento?.filter(p => p.situacao === 'ativo') ?? []
  const padraosDoAno = padraosAtivos.filter(p => p.ano === form.ano)

  const togglePadrao = (id: string) => {
    setPadraoPagamentoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const textMuted = 'hsl(var(--text-muted))'
  const bgElevated = 'hsl(var(--bg-elevated))'
  const borderSubtle = '1px solid hsl(var(--border-subtle))'
  const segColor = SEG_COLORS[form.serie] ?? '#3b82f6'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 860, border: borderSubtle, boxShadow: '0 32px 100px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: borderSubtle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: bgElevated }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            {/* Ícone com sigla — flex fixo, nunca expande */}
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: `${segColor}20`, border: `2px solid ${segColor}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 900, color: segColor,
              fontFamily: 'Outfit, sans-serif', overflow: 'hidden',
              letterSpacing: '-0.5px',
            }}>
              {form.nome ? form.nome.slice(0, 2).toUpperCase() : '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {editingId ? `Editar Turma — ${editing?.nome}` : (form.nome || 'Nova Turma')}
              </div>
              <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
                {form.serie} • {form.turno} • {form.unidade} • Ano {form.ano}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: borderSubtle, background: bgElevated, overflowX: 'auto' }}>
          {ABAS.map(a => {
            const Icon = a.icon
            const active = aba === a.id
            return (
              <button key={a.id} onClick={() => setAba(a.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 20px',
                // usa boxShadow para indicador ativo — evita conflito border/borderBottom
                boxShadow: active ? `inset 0 -2px 0 ${segColor}` : 'none',
                color: active ? segColor : textMuted,
                fontWeight: active ? 700 : 400,
                fontSize: 13,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}>
                <Icon size={14} />{a.label}
                {a.id === 'alunos' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `${segColor}20`, color: segColor, fontWeight: 800 }}>{alunosDaTurma.length}</span>}
                {a.id === 'disciplinas' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `${segColor}20`, color: segColor, fontWeight: 800 }}>{disciplinas.length}</span>}
                {a.id === 'horarios' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `${segColor}20`, color: segColor, fontWeight: 800 }}>{horarios.length}</span>}
              </button>
            )
          })}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '24px 28px', maxHeight: '58vh', overflowY: 'auto' }}>

          {/* ─── ABA: DADOS GERAIS ─── */}
          {aba === 'geral' && (
            <div>
              {/* KPIs rápidos */}
              {editingId && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Alunos', value: alunosDaTurma.length, color: '#3b82f6' },
                    { label: 'Vagas livres', value: vagasLivres, color: vagasLivres > 0 ? '#10b981' : '#ef4444' },
                    { label: 'Disciplinas', value: disciplinas.length, color: '#8b5cf6' },
                    { label: 'Aulas/sem.', value: totalCargaHoraria, color: '#f59e0b' },
                  ].map(k => (
                    <div key={k.label} className="kpi-card">
                      <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Linha 1: Código (auto) + Nome (maior) + Segmento + Turno */}
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 120px 130px', gap: 14, marginBottom: 14 }}>
                {/* Código auto-gerado */}
                <div>
                  <label className="form-label">Código da Turma</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                    <span style={{ padding: '0 10px', fontSize: 11, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center' }}>AUTO</span>
                    <span style={{ padding: '0 10px', fontWeight: 800, fontSize: 14, fontFamily: 'Outfit, monospace', color: segColor, letterSpacing: '0.03em' }}>
                      {form.codigo || (form.nome ? gerarCodigoTurma(form.serie, form.turno) : '—')}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Gerado automaticamente</div>
                </div>
                {/* Nome — campo maior */}
                <div>
                  <label className="form-label">Nome da Turma *</label>
                  <input className="form-input" value={form.nome} onChange={e => {
                    const nome = e.target.value
                    // Ao mudar nome na criação, re-gera código
                    if (!editingId) setForm(p => ({ ...p, nome, codigo: nome ? gerarCodigoTurma(form.serie, form.turno) : '' }))
                    else set('nome', nome)
                  }}
                  placeholder="Ex: 9A, Turma Azul, EF1-Manhã..." style={{ fontWeight: 700, fontSize: 15 }} />
                </div>
                {/* Segmento — menor */}
                <div>
                  <label className="form-label">Segmento *</label>
                  <select className="form-input" value={form.serie} onChange={e => {
                    const serie = e.target.value
                    setForm(p => ({ ...p, serie, codigo: p.nome ? gerarCodigoTurma(serie, p.turno) : '' }))
                  }}>
                    {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {/* Turno — menor */}
                <div>
                  <label className="form-label">Turno *</label>
                  <select className="form-input" value={form.turno} onChange={e => {
                    const turno = e.target.value
                    setForm(p => ({ ...p, turno, codigo: p.nome ? gerarCodigoTurma(p.serie, turno) : '' }))
                  }}>
                    {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Unidade</label>
                  {unidadesList.length > 0 ? (
                    <select className="form-input" value={form.unidade} onChange={e => set('unidade', e.target.value)}>
                      <option value="">Selecionar unidade</option>
                      {unidadesList.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <input
                      className="form-input"
                      value={form.unidade}
                      onChange={e => set('unidade', e.target.value)}
                      placeholder="Nome da unidade..."
                    />
                  )}
                </div>
                <div>
                  <label className="form-label">Sala</label>
                  <input className="form-input" value={form.sala} onChange={e => set('sala', e.target.value)} placeholder="Ex: Sala 201" />
                </div>
                <div>
                  <label className="form-label">Ano Letivo</label>
                  <input type="number" className="form-input" value={form.ano} onChange={e => set('ano', +e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Professor(a) Responsavel</label>
                  {professores.length > 0 ? (
                    <select className="form-input" value={form.professor} onChange={e => set('professor', e.target.value)}>
                      <option value="">Selecionar professor</option>
                      {professores.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" value={form.professor} onChange={e => set('professor', e.target.value)} placeholder="Nome do professor" />
                  )}
                </div>
                <div>
                  <label className="form-label">Capacidade (alunos)</label>
                  <input type="number" className="form-input" value={form.capacidade} onChange={e => set('capacidade', +e.target.value)} min={1} />
                </div>
                <div>
                  <label className="form-label">Matriculados (atual)</label>
                  {/* Calculado automaticamente pelo nº de alunos vinculados à turma */}
                  <div style={{
                    height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))',
                    background: 'hsl(var(--bg-elevated))',
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: segColor, fontFamily: 'Outfit, sans-serif' }}>
                      {alunosDaTurma.length}
                    </span>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>aluno(s) na turma</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 7px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderRadius: 5, fontWeight: 700 }}>AUTO</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Calculado pelo nº de alunos matriculados</div>
                </div>
              </div>

              {/* Barra de ocupacao */}
              <div style={{ padding: '14px 16px', background: bgElevated, borderRadius: 10, border: borderSubtle }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: textMuted }}>OCUPACAO DA TURMA</div>
                <OccupancyBar mat={alunosDaTurma.length} cap={form.capacidade} />
                {alunosDaTurma.length >= form.capacidade && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontWeight: 700 }}>Turma sem vagas — considere aumentar a capacidade ou criar uma nova turma.</div>}
                {alunosDaTurma.length < form.capacidade && (form.capacidade - alunosDaTurma.length) <= 5 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6, fontWeight: 700 }}>Atencao: apenas {form.capacidade - alunosDaTurma.length} vaga(s) disponivel(is).</div>}
              </div>
            </div>
          )}

          {/* ─── ABA: ALUNOS ─── */}
          {aba === 'alunos' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Alunos da turma */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: segColor }}>Alunos matriculados ({alunosDaTurma.length})</div>
                  {alunosDaTurma.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 10, color: textMuted, fontSize: 13 }}>
                      <Users size={32} style={{ opacity: 0.2, marginBottom: 8 }} /><br />Nenhum aluno nesta turma
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                      {alunosDaTurma.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: bgElevated, borderRadius: 8, border: borderSubtle }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${segColor}20`, color: segColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {a.nome.charAt(0)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</div>
                            <div style={{ fontSize: 11, color: textMuted }}>{a.matricula}</div>
                          </div>
                          <button onClick={() => desmatricularAluno(a.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171', flexShrink: 0 }} title="Remover da turma">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Adicionar alunos */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: textMuted }}>Alunos sem turma ({alunosDisponiveis.length})</div>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
                    <input className="form-input" style={{ paddingLeft: 32, fontSize: 12 }} placeholder="Buscar aluno..." value={searchAluno} onChange={e => setSearchAluno(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                    {alunosDisponiveis.length === 0 ? (
                      <div style={{ fontSize: 12, color: textMuted, textAlign: 'center', padding: '16px' }}>Nenhum aluno disponivel{searchAluno ? ` para "${searchAluno}"` : ''}</div>
                    ) : alunosDisponiveis.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: bgElevated, borderRadius: 8, border: borderSubtle }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(107,114,128,0.2)', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {a.nome.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</div>
                          <div style={{ fontSize: 11, color: textMuted }}>{a.matricula || a.cpf}</div>
                        </div>
                        <button onClick={() => matricularAluno(a.id)} className="btn btn-primary btn-sm" style={{ fontSize: 10, padding: '3px 8px', flexShrink: 0 }}>
                          <UserPlus size={10} />Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {form.capacidade > 0 && (
                <div style={{ marginTop: 14, padding: '10px 16px', background: vagasLivres <= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 8, border: `1px solid ${vagasLivres <= 0 ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}` }}>
                  <OccupancyBar mat={alunosDaTurma.length} cap={form.capacidade} />
                </div>
              )}
            </div>
          )}

          {/* ─── ABA: DISCIPLINAS ─── */}
          {aba === 'disciplinas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: segColor }}>Disciplinas da Turma</div>
                  <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>Total: {totalCargaHoraria}h/semana</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setAddDisciplina(p => !p)}><Plus size={13} />Adicionar</button>
              </div>

              {addDisciplina && (
                <div style={{ padding: '16px', background: bgElevated, borderRadius: 10, border: borderSubtle, marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Codigo</label>
                      <input className="form-input" value={discForm.codigo} onChange={e => setDiscForm(p => ({ ...p, codigo: e.target.value }))} placeholder="MAT" />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Disciplina *</label>
                      {disciplinasConfig.length > 0 ? (
                        <select className="form-input" value={discForm.nome} onChange={e => { const d = disciplinasConfig.find(x => x.nome === e.target.value); setDiscForm(p => ({ ...p, nome: e.target.value, codigo: d?.codigo ?? p.codigo })) }}>
                          <option value="">Selecionar</option>
                          {disciplinasConfig.map(d => <option key={d.id} value={d.nome}>{d.nome}</option>)}
                        </select>
                      ) : (
                        <input className="form-input" value={discForm.nome} onChange={e => setDiscForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Matematica" />
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Professor</label>
                      {professores.length > 0 ? (
                        <select className="form-input" value={discForm.professor} onChange={e => setDiscForm(p => ({ ...p, professor: e.target.value }))}>
                          <option value="">Selecionar</option>
                          {professores.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                        </select>
                      ) : (
                        <input className="form-input" value={discForm.professor} onChange={e => setDiscForm(p => ({ ...p, professor: e.target.value }))} placeholder="Professor" />
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>h/semana</label>
                      <input type="number" className="form-input" value={discForm.cargaHoraria} onChange={e => setDiscForm(p => ({ ...p, cargaHoraria: +e.target.value }))} min={1} max={40} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setAddDisciplina(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={addDisc} disabled={!discForm.nome}><Check size={13} />Adicionar</button>
                  </div>
                </div>
              )}

              {disciplinas.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 10, color: textMuted }}>
                  <BookOpen size={36} style={{ opacity: 0.15, marginBottom: 8 }} /><br />
                  <div style={{ fontSize: 13 }}>Nenhuma disciplina adicionada</div>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead><tr><th>Codigo</th><th>Disciplina</th><th>Professor</th><th>h/sem</th><th></th></tr></thead>
                    <tbody>
                      {disciplinas.map(d => (
                        <tr key={d.id}>
                          <td><code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4 }}>{d.codigo || '—'}</code></td>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{d.nome}</td>
                          <td style={{ fontSize: 12, color: textMuted }}>{d.professor || '—'}</td>
                          <td><span style={{ fontSize: 12, fontWeight: 700, color: segColor }}>{d.cargaHoraria}h</span></td>
                          <td><button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setDisciplinas(prev => prev.filter(x => x.id !== d.id))}><Trash2 size={12} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '8px 16px', borderTop: borderSubtle, fontSize: 12, color: textMuted, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{disciplinas.length} disciplina(s)</span>
                    <span style={{ fontWeight: 700, color: segColor }}>Total: {totalCargaHoraria}h/semana</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA: HORARIOS ─── */}
          {aba === 'horarios' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: segColor }}>Grade Horaria ({horarios.length} aulas)</div>
                <button className="btn btn-primary btn-sm" onClick={() => setAddHorario(p => !p)}><Plus size={13} />Novo Slot</button>
              </div>

              {addHorario && (
                <div style={{ padding: '16px', background: bgElevated, borderRadius: 10, border: borderSubtle, marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Dia</label>
                      <select className="form-input" value={slotForm.dia} onChange={e => setSlotForm(p => ({ ...p, dia: e.target.value }))}>
                        {DIAS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Inicio</label>
                      <input type="time" className="form-input" value={slotForm.horaInicio} onChange={e => setSlotForm(p => ({ ...p, horaInicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Fim</label>
                      <input type="time" className="form-input" value={slotForm.horaFim} onChange={e => setSlotForm(p => ({ ...p, horaFim: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Disciplina *</label>
                      {disciplinas.length > 0 ? (
                        <select className="form-input" value={slotForm.disciplina} onChange={e => { const d = disciplinas.find(x => x.nome === e.target.value); setSlotForm(p => ({ ...p, disciplina: e.target.value, professor: d?.professor ?? p.professor })) }}>
                          <option value="">Selecionar</option>
                          {disciplinas.map(d => <option key={d.id} value={d.nome}>{d.nome}</option>)}
                        </select>
                      ) : (
                        <input className="form-input" value={slotForm.disciplina} onChange={e => setSlotForm(p => ({ ...p, disciplina: e.target.value }))} placeholder="Disciplina" />
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Professor</label>
                      <input className="form-input" value={slotForm.professor} onChange={e => setSlotForm(p => ({ ...p, professor: e.target.value }))} placeholder="Auto" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setAddHorario(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={addSlot} disabled={!slotForm.disciplina}><Check size={13} />Adicionar</button>
                  </div>
                </div>
              )}

              {/* Grade visual por dia */}
              {horarios.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 10, color: textMuted }}>
                  <Clock size={36} style={{ opacity: 0.15, marginBottom: 8 }} /><br />
                  <div style={{ fontSize: 13 }}>Nenhum horario definido. Adicione disciplinas primeiro.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DIAS.filter(d => horarios.some(h => h.dia === d)).map(dia => (
                    <div key={dia}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dia}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {horarios.filter(h => h.dia === dia).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)).map(h => (
                          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: bgElevated, borderRadius: 8, border: borderSubtle }}>
                            <span style={{ fontSize: 11, color: textMuted, fontWeight: 700, minWidth: 90 }}>{h.horaInicio} — {h.horaFim}</span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{h.disciplina}</span>
                            <span style={{ fontSize: 11, color: textMuted }}>{h.professor}</span>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setHorarios(prev => prev.filter(x => x.id !== h.id))}><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── ABA: FINANCEIRO ─── */}
          {aba === 'financeiro' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: segColor }}>Configuracao Financeira da Turma</div>

              {/* Seletor de Padrao de Pagamento */}
              <div style={{ padding: '16px 20px', background: bgElevated, borderRadius: 12, border: borderSubtle, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Padrões de Pagamento Vinculados</div>

                {padraosDoAno.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#f59e0b', padding: '10px 0' }}>
                    <AlertCircle size={16} />
                    Nenhum padrão ativo para {form.ano}. Crie em Administrativo &rarr; Config. Financeiro &rarr; Padrão de Pagamentos.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: textMuted, marginBottom: 5 }}>Selecione os padrões que estarão disponíveis para esta turma:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {padraosDoAno.map(p => {
                        const isSelected = padraoPagamentoIds.includes(p.id)
                        return (
                          <div
                            key={p.id}
                            onClick={() => togglePadrao(p.id)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              border: `1.5px solid ${isSelected ? segColor : 'hsl(var(--border-subtle))'}`,
                              background: isSelected ? `${segColor}08` : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              transition: 'all 0.2s',
                            }}
                          >
                            <div style={{
                              width: 20, height: 20, borderRadius: 6,
                              border: `2px solid ${isSelected ? segColor : 'hsl(var(--text-muted))'}`,
                              background: isSelected ? segColor : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', transition: 'all 0.2s'
                            }}>
                              {isSelected && <Check size={14} strokeWidth={3} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? segColor : 'inherit' }}>{p.nome}</div>
                              <div style={{ fontSize: 11, color: textMuted }}>
                                {p.totalParcelas}x {(p.anuidade / p.totalParcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Resumo financeiro dos alunos */}
              <div style={{ padding: '16px 20px', background: bgElevated, borderRadius: 12, border: borderSubtle, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Resumo Financeiro dos Alunos</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { label: 'Total alunos', value: alunosDaTurma.length, color: '#3b82f6' },
                    { label: 'Inadimplentes', value: alunosDaTurma.filter(a => a.inadimplente).length, color: '#ef4444' },
                    { label: 'Regulares', value: alunosDaTurma.filter(a => !a.inadimplente).length, color: '#10b981' },
                  ].map(k => (
                    <div key={k.label} className="kpi-card">
                      <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de alunos com situacao financeira */}
              {alunosDaTurma.length > 0 && (
                <div className="table-container">
                  <table>
                    <thead><tr><th>Aluno</th><th>Matricula</th><th>Situacao Financeira</th></tr></thead>
                    <tbody>
                      {alunosDaTurma.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{a.nome}</td>
                          <td><code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4 }}>{a.matricula}</code></td>
                          <td>
                            {a.inadimplente
                              ? <span className="badge badge-danger">Inadimplente</span>
                              : <span className="badge badge-success">Regular</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '18px 28px',
          borderTop: borderSubtle,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'hsl(var(--bg-elevated))',
          backdropFilter: 'blur(12px)',
          gap: 12,
        }}>
          {/* Info da turma à esquerda */}
          <div style={{ fontSize: 12, color: textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
            {form.nome && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20,
                background: `${segColor}15`, border: `1px solid ${segColor}30`,
              }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: segColor, flexShrink: 0 }} />
                <strong style={{ color: segColor, fontWeight: 800 }}>{form.nome}</strong>
                <span style={{ color: textMuted }}>· {form.serie} · {form.turno} · {form.ano}</span>
              </span>
            )}
          </div>

          {/* Botões à direita */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {/* Cancelar */}
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 22px', borderRadius: 12, cursor: 'pointer',
                fontWeight: 700, fontSize: 13, letterSpacing: -.1,
                background: 'hsl(var(--bg-overlay))',
                color: 'hsl(var(--text-secondary))',
                border: '1.5px solid hsl(var(--border-subtle))',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(239,68,68,0.08)'; b.style.color = '#f87171'; b.style.borderColor = 'rgba(239,68,68,0.3)' }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'hsl(var(--bg-overlay))'; b.style.color = 'hsl(var(--text-secondary))'; b.style.borderColor = 'hsl(var(--border-subtle))' }}
            >
              <X size={15} /> Cancelar
            </button>

            {/* Salvar / Criar */}
            <button
              onClick={handleSave}
              disabled={!form.nome.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 26px', borderRadius: 12, cursor: form.nome.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 800, fontSize: 13, letterSpacing: -.2,
                background: form.nome.trim()
                  ? `linear-gradient(135deg, ${segColor}, ${segColor}cc)`
                  : 'hsl(var(--bg-overlay))',
                color: form.nome.trim() ? '#fff' : 'hsl(var(--text-muted))',
                border: 'none',
                boxShadow: form.nome.trim() ? `0 4px 16px ${segColor}40, 0 1px 4px rgba(0,0,0,0.2)` : 'none',
                opacity: form.nome.trim() ? 1 : 0.5,
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { if (form.nome.trim()) { const b = e.currentTarget; b.style.boxShadow = `0 6px 22px ${segColor}55, 0 2px 6px rgba(0,0,0,0.25)`; b.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.boxShadow = form.nome.trim() ? `0 4px 16px ${segColor}40, 0 1px 4px rgba(0,0,0,0.2)` : 'none'; b.style.transform = 'translateY(0)' }}
            >
              <Check size={15} strokeWidth={2.5} />
              {editingId ? 'Salvar Alterações' : 'Criar Turma'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
