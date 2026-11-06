'use client'

import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Calendar,
  BadgeDollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Trash2,
  Edit3,
  RefreshCw,
  FileSpreadsheet,
  Sparkles,
  Send,
  Check
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL 1: CRIAR NOVA COBRANÇA DIGITAL
══════════════════════════════════════════════════════════════════════════ */
interface NovaCobrancaModalProps {
  isOpen: boolean
  onClose: () => void
  turmasList: string[]
  activeAlunosList: Array<{ id: string; nome: string; turma: string; matricula: string }>
  onCreateSuccess: () => void
  apiFetchFn: (url: string, init?: RequestInit) => Promise<Response>
}

export function NovaCobrancaModal({
  isOpen,
  onClose,
  turmasList,
  activeAlunosList,
  onCreateSuccess,
  apiFetchFn
}: NovaCobrancaModalProps) {
  const [titulo, setTitulo] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [descricao, setDescricao] = useState('')
  const [publico, setPublico] = useState<'todos' | 'turmas' | 'alunos'>('turmas')
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([])
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([])
  const [alunoSearch, setAlunoSearch] = useState('')
  const [criarComunicado, setCriarComunicado] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const filteredAlunos = useMemo(() => {
    if (!alunoSearch.trim()) return activeAlunosList.slice(0, 60)
    const q = alunoSearch.toLowerCase().trim()
    return activeAlunosList
      .filter(
        a =>
          a.nome.toLowerCase().includes(q) ||
          a.turma.toLowerCase().includes(q) ||
          a.matricula.toLowerCase().includes(q)
      )
      .slice(0, 60)
  }, [activeAlunosList, alunoSearch])

  const toggleTurma = (t: string) => {
    setSelectedTurmas(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))
  }

  const toggleAluno = (id: string) => {
    setSelectedAlunos(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) {
      toast.error('Informe o título/motivo da cobrança.')
      return
    }
    const vNum = parseFloat(valor.replace(/\./g, '').replace(',', '.'))
    if (isNaN(vNum) || vNum <= 0) {
      toast.error('Informe um valor unitário válido maior que zero.')
      return
    }
    if (!vencimento) {
      toast.error('Selecione a data de vencimento.')
      return
    }
    if (publico === 'turmas' && selectedTurmas.length === 0) {
      toast.error('Selecione pelo menos uma turma destinatária.')
      return
    }
    if (publico === 'alunos' && selectedAlunos.length === 0) {
      toast.error('Selecione pelo menos um aluno destinatário.')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetchFn('/api/cobrancas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          valor: vNum,
          vencimento,
          descricao: descricao.trim(),
          publico,
          turmas: selectedTurmas,
          alunosIds: selectedAlunos,
          criarComunicado
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Falha ao criar cobrança.')
        return
      }
      toast.success(`Cobrança criada com sucesso para ${data.totalDestinatarios} destinatário(s)!`)
      setTitulo('')
      setValor('')
      setDescricao('')
      setSelectedTurmas([])
      setSelectedAlunos([])
      onCreateSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro de conexão ao criar cobrança.')
    } finally {
      setSubmitting(false)
    }
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <motion.div
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 660,
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '22px 28px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <BadgeDollarSign size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                    Nova Cobrança Digital
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, opacity: 0.9 }}>
                    Gere cobranças via Pix / Cartão (Mercado Pago) integradas à Agenda Digital
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(255,255,255,0.16)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 6 }}>
                  Motivo / Título da Cobrança *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Passeio Pedagógico, Camiseta do Evento, Taxa de Material..."
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 6 }}>
                    Valor Unitário (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 45,00"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 6 }}>
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={vencimento}
                    onChange={e => setVencimento(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Público-Alvo */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 8 }}>
                  Destinatários da Cobrança *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'turmas', label: 'Por Turmas' },
                    { id: 'alunos', label: 'Alunos Específicos' },
                    { id: 'todos', label: `Toda a Escola (${activeAlunosList.length})` }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPublico(opt.id as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: publico === opt.id ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                        background: publico === opt.id ? '#eef2ff' : '#f8fafc',
                        color: publico === opt.id ? '#4338ca' : '#475569',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {publico === 'turmas' && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      maxHeight: 160,
                      overflowY: 'auto',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6
                    }}
                  >
                    {turmasList.map(t => {
                      const active = selectedTurmas.includes(t)
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTurma(t)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: active ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                            background: active ? '#4f46e5' : '#ffffff',
                            color: active ? '#ffffff' : '#334155',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}
                        >
                          {active && <Check size={12} />}
                          {t}
                        </button>
                      )
                    })}
                  </div>
                )}

                {publico === 'alunos' && (
                  <div style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', padding: 12 }}>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Buscar aluno por nome ou turma..."
                        value={alunoSearch}
                        onChange={e => setAlunoSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 30px',
                          borderRadius: 9,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          background: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    {selectedAlunos.length > 0 && (
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4f46e5', marginBottom: 6 }}>
                        {selectedAlunos.length} aluno(s) selecionado(s)
                      </div>
                    )}
                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredAlunos.map(a => {
                        const sel = selectedAlunos.includes(a.id)
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => toggleAluno(a.id)}
                            style={{
                              padding: '7px 10px',
                              borderRadius: 8,
                              border: sel ? '1px solid #4f46e5' : '1px solid transparent',
                              background: sel ? '#eef2ff' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{a.nome}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{a.turma}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Opção de Comunicado Automático */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={criarComunicado}
                    onChange={e => setCriarComunicado(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }}
                  />
                  Publicar comunicado automático na Agenda Digital com o botão &quot;Pagar Agora&quot;
                </label>

                {criarComunicado && (
                  <textarea
                    rows={2}
                    placeholder="Mensagem opcional do comunicado (se vazio, usa texto padrão com valor e vencimento)..."
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                )}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontSize: 13.5,
                    fontWeight: 800,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 6px 18px rgba(79, 70, 229, 0.28)'
                  }}
                >
                  {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                  {submitting ? 'Emitindo Cobrança...' : 'Emitir Cobrança Digital'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL 2: EDITAR COBRANÇA EXISTENTE (TÍTULO, VALOR, VENCIMENTO, SYNC)
══════════════════════════════════════════════════════════════════════════ */
interface EditarCobrancaModalProps {
  group: any | null
  onClose: () => void
  onSaved: () => void
  apiFetchFn: (url: string, init?: RequestInit) => Promise<Response>
}

export function EditarCobrancaModal({ group, onClose, onSaved, apiFetchFn }: EditarCobrancaModalProps) {
  const [titulo, setTitulo] = useState(group?.cobranca?.titulo || '')
  const [valor, setValor] = useState(group?.cobranca?.valor ? String(group.cobranca.valor).replace('.', ',') : '')
  const [vencimento, setVencimento] = useState(
    group?.cobranca?.vencimento ? String(group.cobranca.vencimento).slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  React.useEffect(() => {
    if (group?.cobranca) {
      setTitulo(group.cobranca.titulo || '')
      setValor(group.cobranca.valor !== undefined ? String(group.cobranca.valor).replace('.', ',') : '')
      setVencimento(group.cobranca.vencimento ? String(group.cobranca.vencimento).slice(0, 10) : '')
    }
  }, [group])

  if (typeof window === 'undefined' || !group) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const vNum = parseFloat(valor.replace(/\./g, '').replace(',', '.'))
    if (!titulo.trim() || isNaN(vNum) || vNum <= 0 || !vencimento) {
      toast.error('Preencha título, valor válido e data de vencimento.')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetchFn('/api/cobrancas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_cobranca',
          id: group.id,
          titulo: titulo.trim(),
          valor: vNum,
          vencimento
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao atualizar cobrança.')
        return
      }
      toast.success('Cobrança atualizada com sucesso!')
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar alterações.')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncRecipients = async () => {
    setSyncing(true)
    try {
      const res = await apiFetchFn('/api/cobrancas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_destinatarios',
          cobranca_id: group.id
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Não foi possível sincronizar os destinatários.')
        return
      }
      if (data.addedCount > 0) {
        toast.success(`${data.addedCount} novo(s) aluno(s) vinculado(s) à cobrança!`)
      } else {
        toast.info('Todos os alunos destinatários do comunicado já estão vinculados.')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao sincronizar destinatários.')
    } finally {
      setSyncing(false)
    }
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <motion.div
        initial={{ y: 20, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          background: '#ffffff',
          borderRadius: 22,
          padding: 26,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#eef2ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Edit3 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Editar Cobrança</h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>Altere motivo, valor ou prorrogue o vencimento</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: '#f1f5f9', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
              Título / Motivo
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                Valor Unitário (R$)
              </label>
              <input
                type="text"
                required
                value={valor}
                onChange={e => setValor(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: 14, fontWeight: 800, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                Vencimento
              </label>
              <input
                type="date"
                required
                value={vencimento}
                onChange={e => setVencimento(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: 14, fontWeight: 700, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                Destinatários vinculados: {group.metrics?.totalEnviados || 0}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                Sincronizar alunos do comunicado vinculado
              </div>
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncRecipients}
              style={{
                padding: '7px 12px',
                borderRadius: 9,
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
                color: '#4338ca',
                fontSize: 12,
                fontWeight: 800,
                cursor: syncing ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              Sincronizar
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 13,
                cursor: saving ? 'wait' : 'pointer'
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ABA 2: MENSALIDADES / TÍTULOS DO ERP
══════════════════════════════════════════════════════════════════════════ */
interface ErpMensalidadesViewProps {
  titulos: any[]
  alunosDirectory: Record<string, any>
  resolveTurmaName?: (rawTurma: any) => string
}

export function ErpMensalidadesView({ titulos, alunosDirectory, resolveTurmaName }: ErpMensalidadesViewProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pago' | 'pendente' | 'atrasado'>('ALL')

  const enrichedTitulos = useMemo(() => {
    return (titulos || []).map(t => {
      const rawAlunoId = String(t.aluno_id || t.alunoId || t.dados?.alunoId || '').replace(/^(a_|_ALU|ALU)/i, '').trim()
      const stu = alunosDirectory[rawAlunoId] || (t.aluno_nome ? alunosDirectory[String(t.aluno_nome).toLowerCase()] : null)
      const alunoNome = t.aluno_nome || t.alunoNome || t.dados?.alunoNome || stu?.nome || rawAlunoId || 'Aluno'
      const rawTurma = stu?.turma || t.turma || t.dados?.turma || '--'
      const turma = resolveTurmaName ? resolveTurmaName(rawTurma) : rawTurma
      const descricao = t.descricao || t.titulo || t.competencia || t.dados?.descricao || 'Mensalidade Escolar'
      const valor = Number(t.valor || t.dados?.valor || 0)
      const vencimento = t.vencimento || t.data_vencimento || t.dados?.vencimento || ''
      const rawStatus = String(t.status || t.dados?.status || 'pendente').toLowerCase()
      const isPaid = rawStatus === 'pago' || rawStatus === 'paid' || rawStatus === 'recebido'
      const vencDate = vencimento ? new Date(String(vencimento).includes('T') ? vencimento : `${vencimento}T23:59:59`) : null
      const isOverdue = !isPaid && (rawStatus === 'atrasado' || (vencDate && !isNaN(vencDate.getTime()) && vencDate < new Date()))
      const normalizedStatus: 'pago' | 'atrasado' | 'pendente' = isPaid ? 'pago' : isOverdue ? 'atrasado' : 'pendente'

      return {
        ...t,
        alunoNome,
        turma,
        descricao,
        valor,
        vencimento,
        normalizedStatus
      }
    })
  }, [titulos, alunosDirectory])

  const filtered = useMemo(() => {
    return enrichedTitulos.filter(t => {
      if (statusFilter !== 'ALL' && t.normalizedStatus !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        if (
          !t.alunoNome.toLowerCase().includes(q) &&
          !t.descricao.toLowerCase().includes(q) &&
          !t.turma.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [enrichedTitulos, statusFilter, search])

  const stats = useMemo(() => {
    let total = 0
    let pago = 0
    let pendente = 0
    let atrasado = 0
    enrichedTitulos.forEach(t => {
      total += t.valor
      if (t.normalizedStatus === 'pago') pago += t.valor
      else if (t.normalizedStatus === 'atrasado') atrasado += t.valor
      else pendente += t.valor
    })
    return { total, pago, pendente, atrasado }
  }, [enrichedTitulos])

  const handleExportErpXlsx = () => {
    if (filtered.length === 0) {
      toast.error('Nenhum título ERP para exportar.')
      return
    }
    const rows = filtered.map(t => ({
      Aluno: t.alunoNome,
      Turma: t.turma,
      Descrição: t.descricao,
      'Vencimento': t.vencimento ? new Date(t.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--',
      'Valor (R$)': t.valor,
      Status: t.normalizedStatus === 'pago' ? 'Pago' : t.normalizedStatus === 'atrasado' ? 'Atrasado' : 'Pendente'
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Mensalidades ERP')
    XLSX.writeFile(wb, `Mensalidades_ERP_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Planilha de mensalidades ERP exportada!')
  }

  return (
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Mini KPI row for ERP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Volume Total ERP</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>R$ {formatBRL(stats.total)}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Recebido (ERP)</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#065f46', marginTop: 4 }}>R$ {formatBRL(stats.pago)}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>A Vencer (ERP)</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#92400e', marginTop: 4 }}>R$ {formatBRL(stats.pendente)}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>Em Atraso (ERP)</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#991b1b', marginTop: 4 }}>R$ {formatBRL(stats.atrasado)}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar aluno, turma ou descrição..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
              background: '#ffffff'
            }}
          >
            <option value="ALL">Todos os Status ({enrichedTitulos.length})</option>
            <option value="pago">Pagos</option>
            <option value="pendente">Pendentes</option>
            <option value="atrasado">Atrasados</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportErpXlsx}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid #10b981',
            background: '#ecfdf5',
            color: '#047857',
            fontSize: 12.5,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <FileSpreadsheet size={15} /> Exportar Mensalidades (.xlsx)
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'hidden', border: '1px solid #e2e8f0', borderRadius: 14, width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '28%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>ALUNO / TURMA</th>
              <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>DESCRIÇÃO / COMPETÊNCIA</th>
              <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>VENCIMENTO</th>
              <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textAlign: 'right' }}>VALOR</th>
              <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textAlign: 'center' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: '#64748b', fontSize: 13.5 }}>
                  Nenhum título do ERP encontrado para o filtro selecionado.
                </td>
              </tr>
            ) : (
              filtered.map((t, idx) => (
                <tr key={t.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>{t.alunoNome}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>{t.turma}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    {t.descricao}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: t.normalizedStatus === 'atrasado' ? '#dc2626' : '#475569' }}>
                    {t.vencimento ? new Date(t.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>
                    R$ {formatBRL(t.valor)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 16,
                        fontSize: 11.5,
                        fontWeight: 800,
                        background:
                          t.normalizedStatus === 'pago'
                            ? '#dcfce7'
                            : t.normalizedStatus === 'atrasado'
                            ? '#fee2e2'
                            : '#fef3c7',
                        color:
                          t.normalizedStatus === 'pago'
                            ? '#15803d'
                            : t.normalizedStatus === 'atrasado'
                            ? '#b91c1c'
                            : '#b45309'
                      }}
                    >
                      {t.normalizedStatus === 'pago'
                        ? 'Pago'
                        : t.normalizedStatus === 'atrasado'
                        ? 'Em Atraso'
                        : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
