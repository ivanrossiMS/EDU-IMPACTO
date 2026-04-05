'use client'

import { useState } from 'react'
import { useData, newId } from '@/lib/dataContext'
import { BookOpen, Plus, X, Trash2, Calendar, Check } from 'lucide-react'

interface PlanoAula {
  id: string; titulo: string; turmaId: string; disciplina: string
  semana: string; objetivos: string; conteudo: string; professor: string; status: 'rascunho' | 'aprovado' | 'aplicado'
}

const DISCIPLINAS = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Educação Física', 'Arte', 'Inglês', 'Biologia', 'Física', 'Química']
const STATUS_OPTS = ['rascunho', 'aprovado', 'aplicado'] as const
const STATUS_COR: Record<string, { bg: string; cor: string }> = {
  rascunho: { bg: 'rgba(100,116,139,0.15)', cor: '#64748b' },
  aprovado: { bg: 'rgba(16,185,129,0.15)', cor: '#10b981' },
  aplicado: { bg: 'rgba(99,102,241,0.15)', cor: '#6366f1' },
}

function getToday() { return new Date().toISOString().slice(0, 10) }

export default function PlanosAulaPage() {
  const { turmas, funcionarios } = useData()
  const [planos, setPlanos] = useState<PlanoAula[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedPlano, setSelectedPlano] = useState<PlanoAula | null>(null)
  const [filterTurma, setFilterTurma] = useState('todas')
  const [form, setForm] = useState({
    titulo: '', turmaId: turmas[0]?.id || '', disciplina: 'Matemática',
    semana: '', objetivos: '', conteudo: '', professor: '', status: 'rascunho' as PlanoAula['status'],
  })

  const professores = funcionarios.filter(f => f.cargo?.toLowerCase().includes('professor')).map(f => f.nome)
  const filtered = filterTurma === 'todas' ? planos : planos.filter(p => p.turmaId === filterTurma)
  const turmaName = (id: string) => turmas.find(t => t.id === id)?.nome || id

  function handleSave() {
    if (!form.titulo || !form.turmaId) return
    setPlanos(prev => [...prev, { id: newId('PLN'), ...form }])
    setShowModal(false)
    setForm({ titulo: '', turmaId: turmas[0]?.id || '', disciplina: 'Matemática', semana: '', objetivos: '', conteudo: '', professor: '', status: 'rascunho' })
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
            <BookOpen size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }} className="gradient-text">Planos de Aula</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Planejamento semanal de aulas por turma e disciplina</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {turmas.length > 0 && (
            <select value={filterTurma} onChange={e => setFilterTurma(e.target.value)} className="input" style={{ minWidth: 160 }}>
              <option value="todas">Todas as turmas</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}>
            <Plus size={16} /> Novo Plano
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total', value: planos.length, cor: '#8b5cf6' },
          { label: 'Aprovados', value: planos.filter(p => p.status === 'aprovado').length, cor: '#10b981' },
          { label: 'Aplicados', value: planos.filter(p => p.status === 'aplicado').length, cor: '#6366f1' },
          { label: 'Rascunhos', value: planos.filter(p => p.status === 'rascunho').length, cor: '#64748b' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.cor }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {turmas.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <BookOpen size={48} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nenhuma turma cadastrada</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>Cadastre turmas em <strong>Acadêmico → Turmas</strong> para criar planos de aula.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <BookOpen size={48} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nenhum plano de aula cadastrado</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>Crie planos de aula semanais para suas turmas e disciplinas.</p>
          <button onClick={() => setShowModal(true)} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            + Criar Plano
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => {
            const badge = STATUS_COR[p.status]
            return (
              <div key={p.id} onClick={() => setSelectedPlano(p)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf650'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen size={20} color="#8b5cf6" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 14 }}>
                    <span>📚 {p.disciplina}</span>
                    <span>👥 {turmaName(p.turmaId)}</span>
                    {p.semana && <span>📅 {p.semana}</span>}
                    {p.professor && <span>👤 {p.professor}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, fontWeight: 700, background: badge.bg, color: badge.cor, flexShrink: 0 }}>{p.status}</span>
                <button onClick={e => { e.stopPropagation(); setPlanos(prev => prev.filter(x => x.id !== p.id)) }} style={{ padding: '7px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedPlano && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedPlano.titulo}</h2>
              <button onClick={() => setSelectedPlano(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {[turmaName(selectedPlano.turmaId), selectedPlano.disciplina, selectedPlano.professor, selectedPlano.semana].filter(Boolean).map((v, i) => (
                <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontWeight: 600 }}>{v}</span>
              ))}
            </div>
            {selectedPlano.objetivos && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Objetivos</div><div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{selectedPlano.objetivos}</div></div>}
            {selectedPlano.conteudo && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Conteúdo</div><div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{selectedPlano.conteudo}</div></div>}
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUS_OPTS.map(s => (
                <button key={s} onClick={() => { setPlanos(prev => prev.map(p => p.id === selectedPlano.id ? { ...p, status: s } : p)); setSelectedPlano(prev => prev ? { ...prev, status: s } : null) }}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${STATUS_COR[s].cor}40`, background: selectedPlano.status === s ? `${STATUS_COR[s].cor}18` : 'transparent', color: STATUS_COR[s].cor, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <span style={{ fontWeight: 800, fontSize: 17 }}>Novo Plano de Aula</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título do plano *" className="input" style={{ width: '100%' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select value={form.turmaId} onChange={e => setForm(f => ({ ...f, turmaId: e.target.value }))} className="input" style={{ width: '100%' }}>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <select value={form.disciplina} onChange={e => setForm(f => ({ ...f, disciplina: e.target.value }))} className="input" style={{ width: '100%' }}>
                  {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <input value={form.semana} onChange={e => setForm(f => ({ ...f, semana: e.target.value }))} placeholder="Semana (ex: 24–28 Mar)" className="input" style={{ width: '100%' }} />
              {professores.length > 0 ? (
                <select value={form.professor} onChange={e => setForm(f => ({ ...f, professor: e.target.value }))} className="input" style={{ width: '100%' }}>
                  <option value="">Professor(a)</option>
                  {professores.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input value={form.professor} onChange={e => setForm(f => ({ ...f, professor: e.target.value }))} placeholder="Professor(a)" className="input" style={{ width: '100%' }} />
              )}
              <textarea value={form.objetivos} onChange={e => setForm(f => ({ ...f, objetivos: e.target.value }))} placeholder="Objetivos da aula..." className="input" rows={3} style={{ width: '100%', resize: 'vertical' }} />
              <textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Conteúdo programático..." className="input" rows={3} style={{ width: '100%', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleSave} disabled={!form.titulo || !form.turmaId}
                style={{ flex: 2, padding: '11px', borderRadius: 10, background: (form.titulo && form.turmaId) ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'rgba(139,92,246,0.3)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                ✓ Criar Plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
