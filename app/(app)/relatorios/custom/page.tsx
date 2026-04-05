'use client'

import { useState } from 'react'
import { Brain, Plus, BarChart2, FileText, Trash2, Save, X, Zap } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { newId } from '@/lib/dataContext'

interface RelatorioSalvo {
  id: string; nome: string; tipo: string; criado: string; descricao: string
}
const BLANK: Omit<RelatorioSalvo, 'id' | 'criado'> = { nome: '', tipo: 'Acadêmico', descricao: '' }

const TIPO_COLORS: Record<string, string> = {
  Acadêmico: '#3b82f6', Financeiro: '#10b981', RH: '#8b5cf6', Geral: '#f59e0b'
}

export default function CustomReportsPage() {
  const [tab, setTab] = useState<'salvos' | 'novo'>('salvos')
  const [relatorios, setRelatorios] = useLocalStorage<RelatorioSalvo[]>('edu-relatorios-custom', [])
  const [form, setForm] = useState<Omit<RelatorioSalvo, 'id' | 'criado'>>(BLANK)
  const [del, setDel] = useState<string | null>(null)

  const save = () => {
    if (!form.nome.trim()) return
    const now = new Date().toLocaleDateString('pt-BR')
    setRelatorios(prev => [...prev, { ...form, id: newId('REL'), criado: now }])
    setForm(BLANK); setTab('salvos')
  }
  const remove = () => { if (del) { setRelatorios(prev => prev.filter(r => r.id !== del)); setDel(null) } }
  const f = (k: keyof typeof BLANK, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Relatórios Personalizados</h1>
          <p className="page-subtitle">Crie e salve relatórios sob medida para a sua escola</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Brain size={13} />Gerar com IA</button>
          <button className="btn btn-primary btn-sm" onClick={() => setTab('novo')}><Plus size={13} />Novo Relatório</button>
        </div>
      </div>

      <div className="tab-list" style={{ marginBottom: 20, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'salvos' ? 'active' : ''}`} onClick={() => setTab('salvos')}><FileText size={13} />Relatórios Salvos</button>
        <button className={`tab-trigger ${tab === 'novo' ? 'active' : ''}`} onClick={() => setTab('novo')}><Plus size={13} />Criar Novo</button>
      </div>

      {tab === 'salvos' && (
        relatorios.length === 0 ? (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <BarChart2 size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum relatório personalizado</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Crie relatórios personalizados com os dados reais do seu sistema.</div>
            <button className="btn btn-primary btn-sm" onClick={() => setTab('novo')}><Plus size={13} />Criar Primeiro Relatório</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {relatorios.map(r => (
              <div key={r.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${TIPO_COLORS[r.tipo] || '#6b7280'}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    📊
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.nome}</div>
                    {r.descricao && <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>{r.descricao}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: `${TIPO_COLORS[r.tipo] || '#6b7280'}1a`, color: TIPO_COLORS[r.tipo] || '#6b7280', fontWeight: 600 }}>{r.tipo}</span>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Criado: {r.criado}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}><Zap size={11} />Gerar</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => setDel(r.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'novo' && (
        <div className="card" style={{ padding: '28px', maxWidth: 600 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Novo Relatório Personalizado</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="form-label">Nome do relatório *</label><input className="form-input" value={form.nome} onChange={e => f('nome', e.target.value)} placeholder="Ex: Análise de frequência por turma" /></div>
            <div><label className="form-label">Tipo / Módulo</label>
              <select className="form-input" value={form.tipo} onChange={e => f('tipo', e.target.value)}>
                <option>Acadêmico</option>
                <option>Financeiro</option>
                <option>RH</option>
                <option>Geral</option>
                <option>CRM</option>
                <option>Administrativo</option>
              </select>
            </div>
            <div><label className="form-label">Descrição (opcional)</label><textarea className="form-input" style={{ minHeight: 72 }} value={form.descricao} onChange={e => f('descricao', e.target.value)} placeholder="Descreva o objetivo deste relatório..." /></div>

            <div style={{ padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, fontSize: 13, color: 'hsl(var(--text-muted))' }}>
              <Brain size={14} style={{ display: 'inline', marginRight: 6, color: '#a78bfa' }} />
              Use o botão "Gerar com IA" acima para criar relatórios automaticamente baseados nos dados reais do seu sistema.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setTab('salvos')}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}><Save size={13} />Salvar Relatório</button>
            </div>
          </div>
        </div>
      )}

      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, padding: 28, maxWidth: 380, border: '1px solid hsl(var(--border-default))', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, marginBottom: 20 }}>Excluir relatório?</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={remove}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
