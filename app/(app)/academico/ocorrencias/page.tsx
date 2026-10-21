'use client'
import { useData, Ocorrencia } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import { isAlunoCursandoTurma, getAlunoTurmaCursando } from '@/lib/studentTurmaUtils'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import { useApp } from '@/lib/context'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { Skeleton } from '@/components/skeletons/Skeleton'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { UpdatingIndicator } from '@/components/skeletons/States'
import {
  Plus, AlertTriangle, CheckCircle, Calendar, User, MessageSquare,
  Trash2, Search, ArrowLeft, Pencil, X, Undo,
  BookOpen, Users, Printer, FileText, Sparkles, ChevronRight, Filter,
  BarChart, Clock, Paperclip, Loader2, ImageIcon, Eye, ExternalLink,
  ArrowUpDown, ShieldAlert, CheckCircle2, Layers
} from 'lucide-react'

const cleanAlunoId = (id: any) => String(id || '').replace(/^a_?/, '').trim()

const doesOcMatchTurma = (o: any, turmaObj: any) => {
  if (!o || !turmaObj) return false
  const tId = String(turmaObj.id || '').trim().toLowerCase()
  const tNome = String(turmaObj.nome || '').trim().toLowerCase()
  const tCodigo = String(turmaObj.codigo || '').trim().toLowerCase()

  const oTurma = String(o.turma || '').trim().toLowerCase()
  const oTurmaId = String(o.turma_id || '').trim().toLowerCase().replace(/^sync-/, '')
  const oTurmaNome = String(o.turmaNome || '').trim().toLowerCase()

  if (tId && (oTurma === tId || oTurmaId === tId || oTurma === `sync-${tId}`)) return true
  if (tNome && (oTurma === tNome || oTurmaNome === tNome)) return true
  if (tCodigo && (oTurma === tCodigo || oTurmaId === tCodigo)) return true

  return false
}

const formatDateBR = (dateStr?: string) => {
  if (!dateStr) return '—'
  const trimmed = String(dateStr).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-')
    return `${d}/${m}/${y}`
  }
  return trimmed
}

const parseOcorrenciaDescricao = (rawDescricao?: string) => {
  const lines = String(rawDescricao || '').split('\n')
  let lancado = ''
  let editado = ''
  let confirmado = ''
  let lancadoRaw = ''
  let confirmadoRaw = ''
  const resto: string[] = []

  for (const line of lines) {
    if (line.startsWith('[Lançado por:')) {
      lancadoRaw = line
      lancado = line.replace('[Lançado por:', '').replace(/\]$/, '').trim()
    } else if (line.startsWith('[Editado por:')) {
      editado = line.replace('[Editado por:', '').replace(/\]$/, '').trim()
    } else if (line.startsWith('[Confirmado por:')) {
      confirmadoRaw = line
      confirmado = line.replace('[Confirmado por:', '').replace(/\]$/, '').trim()
    } else {
      resto.push(line)
    }
  }

  const textoLimpo = resto.join('\n').trim()
  return {
    textoLimpo: textoLimpo || String(rawDescricao || '').trim(),
    lancado,
    editado,
    confirmado,
    lancadoRaw,
    confirmadoRaw,
  }
}

const BLANK: Omit<Ocorrencia, 'id' | 'createdAt'> = {
  alunoId: '',
  alunoNome: '',
  turma: '',
  descricao: '',
  data: new Date().toISOString().split('T')[0],
  responsavel: '',
  ciencia_responsavel: false,
  anexoUrl: '',
  anexoNome: '',
  anexoTipo: '',
  anexoTamanho: 0,
}

const SEG_COLORS: Record<string, string> = {
  EI: '#10b981',
  EF1: '#3b82f6',
  EF2: '#8b5cf6',
  EM: '#f59e0b',
  EJA: '#ec4899',
}

// ── Search dropdown de aluno ──────────────────────────────────────────────────
function AlunoSearch({
  value,
  selectedId,
  selectedTurma,
  onChange,
  alunosDaTurma,
  todosAlunos,
  hasError,
  onClearError,
}: {
  value: string
  selectedId?: string
  selectedTurma?: string
  onChange: (id: string, nome: string, turma: string) => void
  alunosDaTurma: { id: string; nome: string; turma: string }[]
  todosAlunos: { id: string; nome: string; turma: string }[]
  hasError?: boolean
  onClearError?: () => void
}) {
  const [q, setQ] = useState(value)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQ(value)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchTerm = q.trim().toLowerCase()

  const filteredTurma = useMemo(() => {
    if (!searchTerm) return alunosDaTurma.slice(0, 8)
    return alunosDaTurma.filter(a => a.nome.toLowerCase().includes(searchTerm)).slice(0, 10)
  }, [alunosDaTurma, searchTerm])

  const filteredGlobal = useMemo(() => {
    if (!searchTerm) return []
    return todosAlunos
      .filter(a => !alunosDaTurma.some(at => at.id === a.id) && a.nome.toLowerCase().includes(searchTerm))
      .slice(0, 10)
  }, [todosAlunos, alunosDaTurma, searchTerm])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
          <input
            id="alunoId"
            name="alunoId"
            className="form-input"
            style={{
              paddingLeft: 40,
              paddingRight: selectedId ? 90 : 14,
              height: '46px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: hasError ? '1.5px solid #ef4444' : selectedId ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
              fontSize: '14px',
              fontWeight: selectedId ? 600 : 400,
              boxShadow: hasError
                ? '0 0 0 3px rgba(239, 68, 68, 0.1)'
                : selectedId
                  ? '0 0 0 3px rgba(59, 130, 246, 0.08)'
                  : 'none',
              transition: 'all 0.2s',
              outline: 'none',
              width: '100%',
            }}
            placeholder="Digite o nome do aluno para buscar..."
            value={q}
            onFocus={() => setDropdownOpen(true)}
            onChange={e => {
              setQ(e.target.value)
              setDropdownOpen(true)
              if (onClearError) onClearError()
            }}
          />
          {selectedId && (
            <span
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CheckCircle2 size={12} /> Selecionado
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDropdownOpen(v => !v)}
          style={{
            height: '46px',
            padding: '0 18px',
            background: 'linear-gradient(135deg, #1e40af, #2563eb)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          }}
        >
          <Search size={15} />
          Buscar
        </button>
      </div>

      {dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 40px -12px rgba(15, 23, 42, 0.18)',
            zIndex: 3100,
            maxHeight: '280px',
            overflowY: 'auto',
            padding: '10px',
          }}
        >
          {filteredTurma.length === 0 && filteredGlobal.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '18px 12px', fontSize: 13 }}>
              {searchTerm ? `Nenhum aluno encontrado para "${q}".` : 'Digite o nome do aluno para pesquisar.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTurma.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#059669',
                      background: '#ecfdf5',
                      borderRadius: '6px',
                      display: 'inline-block',
                      marginBottom: '6px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {selectedTurma ? `ALUNOS DA TURMA (${selectedTurma})` : 'SUGESTÕES DE ALUNOS'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredTurma.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onChange(a.id, a.nome, a.turma)
                          setQ(a.nome)
                          setDropdownOpen(false)
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          background: selectedId === a.id ? '#eff6ff' : '#fff',
                          border: selectedId === a.id ? '1px solid #bfdbfe' : '1px solid transparent',
                          borderRadius: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          if (selectedId !== a.id) e.currentTarget.style.background = '#f8fafc'
                        }}
                        onMouseLeave={e => {
                          if (selectedId !== a.id) e.currentTarget.style.background = '#fff'
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(a.nome)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.nome}</div>
                          {a.turma && <div style={{ fontSize: 11, color: '#64748b' }}>{a.turma}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredGlobal.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#2563eb',
                      background: '#eff6ff',
                      borderRadius: '6px',
                      display: 'inline-block',
                      marginBottom: '6px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    OUTRAS TURMAS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredGlobal.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onChange(a.id, a.nome, a.turma)
                          setQ(a.nome)
                          setDropdownOpen(false)
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          background: '#fff',
                          border: '1px solid transparent',
                          borderRadius: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(a.nome)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.nome}</div>
                          {a.turma && <div style={{ fontSize: 11, color: '#64748b' }}>{a.turma}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OcorrenciaModal({
  form,
  setForm,
  onSave,
  onClose,
  alunosDaTurma,
  todosAlunos,
  turmas,
  validationErrors,
  setValidationErrors,
  isEditing,
}: {
  form: Omit<Ocorrencia, 'id' | 'createdAt'>
  setForm: React.Dispatch<React.SetStateAction<Omit<Ocorrencia, 'id' | 'createdAt'>>>
  onSave: () => void
  onClose: () => void
  alunosDaTurma: { id: string; nome: string; turma: string }[]
  todosAlunos: { id: string; nome: string; turma: string }[]
  turmas: any[]
  validationErrors: { field: string; label: string }[]
  setValidationErrors: React.Dispatch<React.SetStateAction<{ field: string; label: string }[]>>
  isEditing?: boolean
}) {
  const [isUploading, setIsUploading] = useState(false)
  const s = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))
  const hasError = (fieldId: string) => validationErrors.some(e => e.field === fieldId)
  const clearError = (fieldId: string) => setValidationErrors(prev => prev.filter(err => err.field !== fieldId))

  const matchedTurma = turmas.find((t: any) => t.nome === form.turma || t.id === form.turma)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(10px)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 540,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          boxShadow: '0 30px 60px rgba(15, 23, 42, 0.2)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho Gradiente Luxo */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)',
            padding: '24px 28px',
            color: '#fff',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  color: '#93c5fd',
                  marginBottom: 4,
                }}
              >
                Registro Pedagógico
              </div>
              <h2
                style={{
                  fontFamily: 'Outfit,sans-serif',
                  fontWeight: 900,
                  fontSize: 22,
                  color: '#fff',
                  margin: 0,
                  letterSpacing: '-0.5px',
                }}
              >
                {isEditing ? 'Editar Ocorrência' : 'Nova Ocorrência Disciplinar'}
              </h2>
            </div>
            <button
              style={{
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Conteúdo do Formulário */}
        <div style={{ padding: '24px 28px', background: '#fff', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '6px',
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Aluno <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <AlunoSearch
                value={form.alunoNome}
                selectedId={form.alunoId}
                selectedTurma={form.turma}
                onChange={(id, nome, turma) => {
                  setForm(p => ({ ...p, alunoId: id, alunoNome: nome, turma: turma || p.turma }))
                  clearError('alunoId')
                }}
                alunosDaTurma={alunosDaTurma}
                todosAlunos={todosAlunos}
                hasError={hasError('alunoId')}
                onClearError={() => clearError('alunoId')}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '6px',
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Ano Letivo
              </label>
              <input
                className="form-input"
                style={{
                  height: '40px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  color: '#475569',
                  fontWeight: 600,
                }}
                value={matchedTurma?.ano || new Date().getFullYear()}
                readOnly
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '6px',
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Turma Vinculada
              </label>
              <input
                className="form-input"
                style={{
                  height: '40px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  color: '#475569',
                  fontWeight: 600,
                }}
                value={matchedTurma?.nome || form.turma || 'Selecione o aluno'}
                readOnly
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '6px',
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Data do Registro <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="data"
                name="data"
                className="form-input"
                style={{
                  height: '40px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: hasError('data') ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                  fontSize: '13px',
                  boxShadow: hasError('data') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                type="date"
                value={form.data}
                onChange={e => {
                  s('data', e.target.value)
                  clearError('data')
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '6px',
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Responsável pelo Registro <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="responsavel"
                name="responsavel"
                className="form-input"
                style={{
                  height: '40px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: hasError('responsavel') ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                  fontSize: '13px',
                  boxShadow: hasError('responsavel') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                value={form.responsavel}
                onChange={e => {
                  s('responsavel', e.target.value)
                  clearError('responsavel')
                }}
                placeholder="Ex: Coordenação / Prof."
              />
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '6px',
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Descrição Detalhada <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                id="descricao"
                name="descricao"
                className="form-input"
                style={{
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: hasError('descricao') ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                  padding: '12px 14px',
                  fontSize: '13.5px',
                  lineHeight: 1.5,
                  boxShadow: hasError('descricao') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                rows={4}
                value={form.descricao}
                onChange={e => {
                  s('descricao', e.target.value)
                  clearError('descricao')
                }}
                placeholder="Descreva o contexto da ocorrência e as medidas pedagógicas aplicadas..."
              />
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '6px',
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Anexo ou Evidência (Opcional)
              </label>
              {form.anexoUrl ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '8px',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {form.anexoTipo?.includes('image') ? <ImageIcon size={16} /> : <FileText size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {form.anexoNome}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {form.anexoTamanho ? (form.anexoTamanho / 1024).toFixed(1) : 0} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      s('anexoUrl', '')
                      s('anexoNome', '')
                      s('anexoTipo', '')
                      s('anexoTamanho', 0)
                    }}
                    style={{
                      border: 'none',
                      background: '#fee2e2',
                      color: '#ef4444',
                      width: 30,
                      height: 30,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 14px',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isUploading ? 0.7 : 1,
                  }}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Enviando arquivo...</div>
                    </>
                  ) : (
                    <>
                      <Paperclip size={15} style={{ color: '#64748b' }} />
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                        Clique para anexar documento ou foto (Máx: 10MB)
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    disabled={isUploading}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 100 * 1024 * 1024) {
                        alert('Arquivo muito grande! Máximo 100MB.')
                        return
                      }
                      setIsUploading(true)
                      try {
                        let fileToUpload: File = file
                        if (file.type.startsWith('image/')) {
                          fileToUpload = await compressImage(file, { quality: 0.8, format: 'image/webp' })
                        } else if (file.type.startsWith('video/')) {
                          fileToUpload = (await compressVideo(file, () => {})) as File
                        }

                        const uploadRes = await uploadFileToSupabase({
                          bucket: 'comunicados-midia',
                          folder: 'ocorrencias',
                          file: fileToUpload,
                          usageType: 'common',
                        })

                        if (!uploadRes.ok || !uploadRes.url) {
                          alert(uploadRes.error || 'Falha no envio do anexo.')
                          return
                        }

                        s('anexoUrl', uploadRes.url)
                        s('anexoNome', fileToUpload.name)
                        s('anexoTipo', fileToUpload.type)
                        s('anexoTamanho', fileToUpload.size)
                      } catch {
                        alert('Erro na conexão ao enviar anexo.')
                      } finally {
                        setIsUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
            <button
              style={{
                height: '42px',
                padding: '0 20px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              style={{
                height: '42px',
                padding: '0 24px',
                background: 'linear-gradient(135deg, #1e40af, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.35)',
              }}
              onClick={onSave}
            >
              <CheckCircle size={16} />
              <span>Salvar Ocorrência</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type QuickDrawerState =
  | { type: 'ocorrencia'; ocorrenciaId: string }
  | { type: 'aluno'; alunoId: string; alunoNome: string; turma: string }
  | { type: 'turma'; turmaNome: string }
  | { type: 'status'; statusFilter: 'todas' | 'pendentes' | 'confirmadas' }
  | null

export default function OcorrenciasPage() {
  const {
    data: rawOcorrencias,
    refetch: refetchOcorrencias,
    isLoading: isLoadingOcorrencias,
    isFetching: isFetchingOcorrencias,
  } = useApiQuery<any[]>(['ocorrencias'], `/api/ocorrencias`, {}, { noCache: true })
  const { cfgCalendarioLetivo = [], cfgNiveisEnsino = [] } = useData()
  const { currentUser: authUser } = useApp()
  const currentUser: any = authUser || {}

  const { data: rawTurmas, isLoading: isLoadingTurmas } = useApiQuery<any[]>(['turmas'], `/api/turmas`)
  const { data: rawAlunos, isLoading: isLoadingAlunos } = useApiQuery<any[]>(
    ['alunos'],
    `/api/alunos?all=true&lightweight=true`
  )

  const ocorrencias = rawOcorrencias || []
  const turmas = (rawTurmas as any)?.data || []
  const alunos = (rawAlunos as any)?.data || rawAlunos || []

  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [modoHome, setModoHome] = useState<'turma' | 'registros' | 'aluno'>('turma')
  const [buscaAlunoHome, setBuscaAlunoHome] = useState('')
  const [alunoSel, setAlunoSel] = useState<{ id: string; nome: string; turma: string } | null>(null)

  const [filtroAno, setFiltroAno] = useState('todos')
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroBuscaHome, setFiltroBuscaHome] = useState('')
  const [buscaTurmaTexto, setBuscaTurmaTexto] = useState('')
  const [filtroTurmasRapido, setFiltroTurmasRapido] = useState<'todas' | 'com_ocorrencias' | 'com_pendencias'>('todas')
  const [ordenarTurmasPorOcorrencias, setOrdenarTurmasPorOcorrencias] = useState(true)

  // Estados para o modo "Registros Diretos"
  const [filtroStatusDireto, setFiltroStatusDireto] = useState<'todas' | 'pendentes' | 'confirmadas' | 'anexo'>('todas')
  const [buscaDireta, setBuscaDireta] = useState('')
  const [filtroTurmaDireta, setFiltroTurmaDireta] = useState('todas')
  const [paginaDireta, setPaginaDireta] = useState(1)

  // Quick Drawer (Slide-over de inspeção direta em 1 clique)
  const [quickDrawer, setQuickDrawer] = useState<QuickDrawerState>(null)
  const drawerDialogRef = useRef<HTMLDialogElement>(null)
  const registrosSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vigente = cfgCalendarioLetivo.find((c: any) => c.status === 'Aberto' || c.isVigente)
    if (vigente) {
      setFiltroAno(String(vigente.ano))
    }
  }, [cfgCalendarioLetivo])

  // Sincronização do <dialog closedby="any"> + fallback para browsers sem suporte nativo a closedBy
  useEffect(() => {
    const dialog = drawerDialogRef.current
    if (!dialog) return

    if (quickDrawer) {
      if (!dialog.open) {
        try {
          dialog.showModal()
        } catch {
          // ignore if already open
        }
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [quickDrawer])

  useEffect(() => {
    const dialog = drawerDialogRef.current
    if (!dialog) return

    const handleClose = () => {
      setQuickDrawer(null)
    }
    dialog.addEventListener('close', handleClose)

    // Fallback para browsers sem suporte a closedBy (ex: Safari)
    const handleBackdropClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return
      if (event.target !== dialog) return
      const rect = dialog.getBoundingClientRect()
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      if (!isDialogContent) {
        dialog.close()
      }
    }
    dialog.addEventListener('click', handleBackdropClick)

    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('click', handleBackdropClick)
    }
  }, [])

  const seriesDisponiveis = useMemo(() => {
    let levels = cfgNiveisEnsino
    if (filtroSeg !== 'todos') {
      levels = cfgNiveisEnsino.filter((n: any) => n.nome === filtroSeg)
    }
    const allSeries = levels.flatMap((n: any) => n.series || [])
    return [...new Set(allSeries.map((s: any) => s.nome))].sort()
  }, [cfgNiveisEnsino, filtroSeg])

  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'confirmadas'>('todas')
  const [busca, setBusca] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Ocorrencia, 'id' | 'createdAt'>>(BLANK)
  const [metaCriacao, setMetaCriacao] = useState('')
  const [metaConfirmacao, setMetaConfirmacao] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [validationErrors, setValidationErrors] = useState<{ field: string; label: string }[]>([])
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [turmaSel, filtroStatus, busca])

  useEffect(() => {
    setPaginaDireta(1)
  }, [filtroStatusDireto, buscaDireta, filtroTurmaDireta])

  const selectedTurmaObj = useMemo(() => {
    const targetTurma = turmaSel || form.turma
    if (!targetTurma) return null
    return (
      turmas.find((t: any) => t.nome === targetTurma && (filtroAno === 'todos' || String(t.ano) === filtroAno)) ||
      turmas.find((t: any) => t.nome === targetTurma || String(t.id) === String(targetTurma)) ||
      null
    )
  }, [turmas, turmaSel, form.turma, filtroAno])

  const alunosDaTurmaAtual = useMemo(() => {
    const activeTurma = turmaSel || form.turma
    if (!activeTurma) {
      return alunos.map((a: any) => ({
        id: a.id,
        nome: a.nome,
        turma: getAlunoTurmaCursando(a) || a.turma || '',
      }))
    }
    return alunos
      .filter(
        (a: any) =>
          a.turma === activeTurma ||
          (selectedTurmaObj &&
            (a.turma === selectedTurmaObj.id ||
              (a as any).turmaId === selectedTurmaObj.id ||
              isAlunoCursandoTurma(a, selectedTurmaObj, selectedTurmaObj.ano, turmas)))
      )
      .map((a: any) => ({
        id: a.id,
        nome: a.nome,
        turma: selectedTurmaObj?.nome || getAlunoTurmaCursando(a) || a.turma || '',
      }))
  }, [alunos, turmaSel, form.turma, turmas, selectedTurmaObj])

  const todosAlunosMapped = useMemo(
    () =>
      alunos.map((a: any) => ({
        id: a.id,
        nome: a.nome,
        turma: getAlunoTurmaCursando(a) || a.turma || '',
      })),
    [alunos]
  )

  const ocDaTurma = turmaSel
    ? ocorrencias.filter(o =>
        selectedTurmaObj
          ? doesOcMatchTurma(o, selectedTurmaObj)
          : String(o.turma || '').trim().toLowerCase() === String(turmaSel).trim().toLowerCase()
      )
    : []

  const filtered = ocDaTurma.filter(o => {
    const ms =
      filtroStatus === 'todas' ? true : filtroStatus === 'pendentes' ? !o.ciencia_responsavel : o.ciencia_responsavel
    const mb =
      !busca ||
      o.alunoNome?.toLowerCase().includes(busca.toLowerCase()) ||
      o.descricao?.toLowerCase().includes(busca.toLowerCase())
    return ms && mb
  })

  const paginatedOcorrencias = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  const openNew = (prefill?: Partial<Omit<Ocorrencia, 'id' | 'createdAt'>>) => {
    setQuickDrawer(null)
    setEditingId(null)
    setMetaCriacao('')
    setMetaConfirmacao('')
    setForm({
      ...BLANK,
      data: new Date().toISOString().split('T')[0],
      responsavel: currentUser?.nome || '',
      turma: turmaSel ?? '',
      ...prefill,
    })
    setValidationErrors([])
    setIsValidationModalOpen(false)
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return
    setQuickDrawer(null)
    setEditingId(id)

    const parsed = parseOcorrenciaDescricao(oc.descricao)
    setMetaCriacao(parsed.lancadoRaw)
    setMetaConfirmacao(parsed.confirmadoRaw)

    setForm({
      alunoId: oc.alunoId || oc.aluno_id || '',
      alunoNome: oc.alunoNome || '',
      turma: oc.turmaNome || oc.turma || '',
      descricao: parsed.textoLimpo,
      data: oc.data || new Date().toISOString().split('T')[0],
      responsavel: oc.responsavel || '',
      ciencia_responsavel: Boolean(oc.ciencia_responsavel),
      anexoUrl: oc.anexoUrl || '',
      anexoNome: oc.anexoNome || '',
      anexoTipo: oc.anexoTipo || '',
      anexoTamanho: oc.anexoTamanho || 0,
    })
    setValidationErrors([])
    setIsValidationModalOpen(false)
    setModalOpen(true)
  }

  const validateForm = () => {
    const errors: { field: string; label: string }[] = []
    if (!form.alunoId || !form.alunoNome.trim()) {
      errors.push({ field: 'alunoId', label: 'Aluno' })
    }
    if (!form.data || !form.data.trim()) {
      errors.push({ field: 'data', label: 'Data' })
    }
    if (!form.responsavel || !form.responsavel.trim()) {
      errors.push({ field: 'responsavel', label: 'Responsável' })
    }
    if (!form.descricao || !form.descricao.trim()) {
      errors.push({ field: 'descricao', label: 'Descrição' })
    }
    return errors
  }

  const handleSave = async () => {
    const errors = validateForm()
    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsValidationModalOpen(true)
      return
    }

    const now = new Date()
    const dataHora =
      now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    let userInfo = ''
    if (editingId) {
      const editInfo = `[Editado por: ${currentUser?.nome || 'Usuário'} em ${dataHora}]`
      userInfo = metaCriacao ? `${metaCriacao}\n${editInfo}` : editInfo
      if (metaConfirmacao) userInfo += `\n${metaConfirmacao}`
    } else {
      userInfo = `[Lançado por: ${currentUser?.nome || 'Usuário'} em ${dataHora}]`
    }

    const payload = {
      ...form,
      id: editingId,
      turma: turmaSel ?? form.turma,
      descricao: form.descricao ? `${userInfo}\n${form.descricao}` : userInfo,
    }
    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        refetchOcorrencias()
        setModalOpen(false)
      } else {
        const err = await response.json()
        alert('Erro ao salvar: ' + (err.error || response.statusText))
      }
    } catch (error: any) {
      alert('Erro na requisição: ' + error.message)
    }
  }

  const marcarCiencia = async (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return

    const now = new Date()
    const dataHora =
      now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const confirmInfo = `[Confirmado por: ${currentUser?.nome || 'Usuário'} em ${dataHora}]`

    const payload = {
      ...oc,
      ciencia_responsavel: true,
      descricao: oc.descricao ? `${oc.descricao}\n${confirmInfo}` : confirmInfo,
    }
    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        refetchOcorrencias()
      }
    } catch (error) {
      console.error('Erro ao marcar ciência:', error)
    }
  }

  const desfazerCiencia = async (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return

    const lines = oc.descricao.split('\n')
    const filteredLines = lines.filter((l: string) => !l.startsWith('[Confirmado por:'))

    const payload = {
      ...oc,
      ciencia_responsavel: false,
      descricao: filteredLines.join('\n').trim(),
    }
    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        refetchOcorrencias()
      }
    } catch (error) {
      console.error('Erro ao desfazer ciência:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta ocorrência?')) return
    try {
      const response = await fetch(`/api/ocorrencias?id=${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        if (quickDrawer?.type === 'ocorrencia' && quickDrawer.ocorrenciaId === id) {
          setQuickDrawer(null)
        }
        refetchOcorrencias()
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
    }
  }

  const printSingleOcorrencia = (oc: any) => {
    const win = window.open('', '_blank')
    if (!win) return
    const parsed = parseOcorrenciaDescricao(oc.descricao)
    win.document.write(
      `<html><head><title>Ocorrência — ${oc.alunoNome}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a;line-height:1.6}h1{font-size:20px;margin-bottom:4px}.meta{color:#475569;font-size:13px;margin-bottom:20px}.box{border:1px solid #cbd5e1;border-radius:8px;padding:16px;background:#f8fafc;margin-bottom:20px}.sig{margin-top:60px;display:flex;justify-content:space-between;gap:40px}.sig div{flex:1;border-top:1px solid #334155;padding-top:8px;text-align:center;font-size:12px}</style></head><body>`
    )
    win.document.write(`<h1>Registro de Ocorrência Disciplinar</h1>`)
    win.document.write(
      `<div class="meta"><strong>Aluno(a):</strong> ${oc.alunoNome} &nbsp;|&nbsp; <strong>Turma:</strong> ${oc.turmaNome || oc.turma || '—'} &nbsp;|&nbsp; <strong>Data:</strong> ${formatDateBR(oc.data)}</div>`
    )
    win.document.write(`<div class="box"><strong>Descrição da Ocorrência:</strong><br/>${parsed.textoLimpo}</div>`)
    win.document.write(
      `<p style="font-size:13px"><strong>Responsável pelo registro:</strong> ${oc.responsavel || '—'}<br/><strong>Status de Ciência:</strong> ${oc.ciencia_responsavel ? 'Confirmada pelos responsáveis' : 'Aguardando ciência dos responsáveis'}</p>`
    )
    win.document.write(
      `<div class="sig"><div>Assinatura da Coordenação / Escola</div><div>Assinatura do Responsável Legal</div></div>`
    )
    win.document.write(`</body></html>`)
    win.document.close()
    win.print()
  }

  const jumpToDirectRecords = (status: 'todas' | 'pendentes' | 'confirmadas' | 'anexo') => {
    setTurmaSel(null)
    setModoHome('registros')
    setFiltroStatusDireto(status)
    setTimeout(() => {
      registrosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  // Dados agregados globais
  const totalOC = ocorrencias.length
  const pendentes = ocorrencias.filter(o => !o.ciencia_responsavel).length
  const confirmadas = ocorrencias.filter(o => o.ciencia_responsavel).length
  const comAnexo = ocorrencias.filter(o => !!o.anexoUrl).length

  const reincidentes = useMemo(() => {
    const map: Record<string, { id: string; nome: string; turma: string; count: number; pendentes: number }> = {}
    ocorrencias.forEach(o => {
      const aId = cleanAlunoId(o.alunoId || o.aluno_id)
      if (!aId) return
      if (!map[aId]) {
        map[aId] = {
          id: aId,
          nome: o.alunoNome || 'Sem Nome',
          turma: o.turmaNome || o.turma || 'Sem Turma',
          count: 0,
          pendentes: 0,
        }
      }
      map[aId].count++
      if (!o.ciencia_responsavel) map[aId].pendentes++
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [ocorrencias])

  const ultimasOC = useMemo(() => {
    return [...ocorrencias]
      .sort((a, b) => {
        const dateA = a.createdAt || a.created_at || a.data || ''
        const dateB = b.createdAt || b.created_at || b.data || ''
        return dateB.localeCompare(dateA)
      })
      .slice(0, 5)
  }, [ocorrencias])

  // Enriquecimento das turmas com contagens para ordenação e filtros rápidos
  const turmasComMetricas = useMemo(() => {
    const base = turmas.filter((t: any) => {
      const levelOfTurma = cfgNiveisEnsino.find((n: any) => n.series?.some((s: any) => s.nome === t.serie))
      const levelName = levelOfTurma?.nome || ''
      const matchAno = filtroAno === 'todos' || String(t.ano) === filtroAno
      const matchSeg = filtroSeg === 'todos' || levelName === filtroSeg
      const matchSerie = !filtroBuscaHome || t.serie === filtroBuscaHome
      const matchTexto =
        !buscaTurmaTexto.trim() ||
        t.nome?.toLowerCase().includes(buscaTurmaTexto.toLowerCase()) ||
        t.serie?.toLowerCase().includes(buscaTurmaTexto.toLowerCase())
      return matchAno && matchSeg && matchSerie && matchTexto
    })

    const enriched = base.map((turma: any) => {
      const ocTurma = ocorrencias.filter(o => doesOcMatchTurma(o, turma))
      const pendTurma = ocTurma.filter(o => !o.ciencia_responsavel).length
      const confTurma = ocTurma.filter(o => o.ciencia_responsavel).length
      const alunosTurma = alunos.filter(
        (a: any) =>
          a.turma === turma.nome ||
          a.turma === turma.id ||
          a.turmaId === turma.id ||
          isAlunoCursandoTurma(a, turma, turma.ano, turmas)
      ).length
      return {
        ...turma,
        ocTurma,
        totalOc: ocTurma.length,
        pendTurma,
        confTurma,
        alunosTurma,
      }
    })

    const filteredByQuick = enriched.filter((t: any) => {
      if (filtroTurmasRapido === 'com_ocorrencias') return t.totalOc > 0
      if (filtroTurmasRapido === 'com_pendencias') return t.pendTurma > 0
      return true
    })

    if (ordenarTurmasPorOcorrencias) {
      return [...filteredByQuick].sort((a, b) => {
        if (b.pendTurma !== a.pendTurma) return b.pendTurma - a.pendTurma
        if (b.totalOc !== a.totalOc) return b.totalOc - a.totalOc
        return String(a.nome || '').localeCompare(String(b.nome || ''))
      })
    }

    return filteredByQuick
  }, [
    turmas,
    cfgNiveisEnsino,
    filtroAno,
    filtroSeg,
    filtroBuscaHome,
    buscaTurmaTexto,
    ocorrencias,
    alunos,
    filtroTurmasRapido,
    ordenarTurmasPorOcorrencias,
  ])

  const countTurmasComOc = useMemo(
    () => turmas.filter((t: any) => ocorrencias.some(o => doesOcMatchTurma(o, t))).length,
    [turmas, ocorrencias]
  )
  const countTurmasComPend = useMemo(
    () => turmas.filter((t: any) => ocorrencias.some(o => doesOcMatchTurma(o, t) && !o.ciencia_responsavel)).length,
    [turmas, ocorrencias]
  )

  // Registros diretos filtrados
  const ocorrenciasDiretasFiltradas = useMemo(() => {
    return [...ocorrencias]
      .sort((a, b) => {
        const dateA = a.createdAt || a.created_at || a.data || ''
        const dateB = b.createdAt || b.created_at || b.data || ''
        return dateB.localeCompare(dateA)
      })
      .filter(o => {
        if (filtroStatusDireto === 'pendentes' && o.ciencia_responsavel) return false
        if (filtroStatusDireto === 'confirmadas' && !o.ciencia_responsavel) return false
        if (filtroStatusDireto === 'anexo' && !o.anexoUrl) return false
        if (filtroTurmaDireta !== 'todas') {
          const tObj = turmas.find((t: any) => t.nome === filtroTurmaDireta || String(t.id) === filtroTurmaDireta)
          if (tObj ? !doesOcMatchTurma(o, tObj) : (o.turmaNome || o.turma) !== filtroTurmaDireta) return false
        }
        if (buscaDireta.trim()) {
          const q = buscaDireta.toLowerCase()
          const matchAluno = o.alunoNome?.toLowerCase().includes(q)
          const matchDesc = o.descricao?.toLowerCase().includes(q)
          const matchTurma = (o.turmaNome || o.turma || '').toLowerCase().includes(q)
          const matchResp = o.responsavel?.toLowerCase().includes(q)
          if (!matchAluno && !matchDesc && !matchTurma && !matchResp) return false
        }
        return true
      })
  }, [ocorrencias, filtroStatusDireto, filtroTurmaDireta, buscaDireta, turmas])

  const ocorrenciasDiretasPaginadas = useMemo(() => {
    const start = (paginaDireta - 1) * itemsPerPage
    return ocorrenciasDiretasFiltradas.slice(start, start + itemsPerPage)
  }, [ocorrenciasDiretasFiltradas, paginaDireta, itemsPerPage])

  // Renderizador de Card de Ocorrência reutilizável (Leve, Luxo e Clicável)
  const renderOcorrenciaCard = (oc: any, options?: { compact?: boolean; showTurmaBadge?: boolean }) => {
    const isConfirmed = Boolean(oc.ciencia_responsavel)
    const parsed = parseOcorrenciaDescricao(oc.descricao)
    const turmaLabel = oc.turmaNome || oc.turma || 'Sem turma'

    return (
      <div
        key={oc.id}
        onClick={() => setQuickDrawer({ type: 'ocorrencia', ocorrenciaId: oc.id })}
        style={{
          display: 'flex',
          gap: 16,
          padding: options?.compact ? '14px 16px' : '18px 22px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderLeft: `4px solid ${isConfirmed ? '#10b981' : '#f59e0b'}`,
          borderRadius: '16px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 10px 24px -6px rgba(15, 23, 42, 0.08)'
          e.currentTarget.style.borderColor = '#cbd5e1'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.02)'
          e.currentTarget.style.borderColor = '#e2e8f0'
        }}
      >
        <div
          style={{
            width: options?.compact ? 38 : 44,
            height: options?.compact ? 38 : 44,
            borderRadius: '12px',
            background: isConfirmed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.12)',
            color: isConfirmed ? '#059669' : '#d97706',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: options?.compact ? '13px' : '14px',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          {getInitials(oc.alunoNome || 'AL')}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                const aId = cleanAlunoId(oc.alunoId || oc.aluno_id)
                setQuickDrawer({
                  type: 'aluno',
                  alunoId: aId,
                  alunoNome: oc.alunoNome || 'Aluno',
                  turma: turmaLabel,
                })
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: options?.compact ? 14 : 15,
                fontWeight: 800,
                color: '#0f172a',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              title="Clique para abrir o dossiê deste aluno"
            >
              {oc.alunoNome || 'Aluno sem nome'}
            </button>

            {options?.showTurmaBadge !== false && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  background: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {turmaLabel}
              </span>
            )}

            {oc.anexoUrl && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#eff6ff',
                  color: '#2563eb',
                  fontWeight: 700,
                }}
              >
                <Paperclip size={11} /> Anexo
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: 13.5,
              color: '#334155',
              lineHeight: 1.55,
              margin: '6px 0 10px 0',
              display: '-webkit-box',
              WebkitLineClamp: options?.compact ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {parsed.textoLimpo}
          </p>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
            {oc.data && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                <Calendar size={13} style={{ color: '#94a3b8' }} />
                {formatDateBR(oc.data)}
              </span>
            )}
            {oc.responsavel && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                <User size={13} style={{ color: '#94a3b8' }} />
                {oc.responsavel}
              </span>
            )}
            {parsed.lancado && !options?.compact && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: '#64748b',
                  background: '#f8fafc',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
              >
                <Clock size={11} style={{ color: '#2563eb' }} />
                {parsed.lancado}
              </span>
            )}
          </div>
        </div>

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          {isConfirmed ? (
            <span
              style={{
                padding: '4px 10px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <CheckCircle size={12} /> Confirmada
            </span>
          ) : (
            <span
              style={{
                padding: '4px 10px',
                background: '#fffbeb',
                color: '#d97706',
                border: '1px solid #fde68a',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <AlertTriangle size={12} /> Aguardando
            </span>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setQuickDrawer({ type: 'ocorrencia', ocorrenciaId: oc.id })}
              style={{
                height: '30px',
                padding: '0 10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#334155',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Ver registro completo"
            >
              <Eye size={13} /> Ver
            </button>

            {isConfirmed ? (
              <button
                type="button"
                onClick={() => desfazerCiencia(oc.id)}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#64748b',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Desfazer confirmação de ciência"
              >
                <Undo size={12} /> Desfazer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => marcarCiencia(oc.id)}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  color: '#2563eb',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Confirmar ciência do responsável"
              >
                <CheckCircle2 size={13} /> Dar Ciência
              </button>
            )}

            <button
              type="button"
              onClick={() => openEdit(oc.id)}
              style={{
                border: '1px solid #e2e8f0',
                background: '#fff',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
              }}
              title="Editar ocorrência"
            >
              <Pencil size={13} />
            </button>

            <button
              type="button"
              onClick={() => handleDelete(oc.id)}
              style={{
                border: '1px solid #fee2e2',
                background: '#fff',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ef4444',
              }}
              title="Excluir ocorrência"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Renderizador do Slide-Over Quick Drawer (<dialog closedby="any">)
  const renderQuickDrawer = () => {
    const activeOc =
      quickDrawer?.type === 'ocorrencia' ? ocorrencias.find(o => o.id === quickDrawer.ocorrenciaId) : null

    const drawerAlunoOcorrencias =
      quickDrawer?.type === 'aluno'
        ? ocorrencias
            .filter(o => cleanAlunoId(o.alunoId || o.aluno_id) === cleanAlunoId(quickDrawer.alunoId))
            .sort((a, b) => (b.createdAt || b.data || '').localeCompare(a.createdAt || a.data || ''))
        : []

    const drawerTurmaObj =
      quickDrawer?.type === 'turma' ? turmas.find((t: any) => t.nome === quickDrawer.turmaNome) : null
    const drawerTurmaOcorrencias =
      quickDrawer?.type === 'turma'
        ? ocorrencias
            .filter(o =>
              drawerTurmaObj
                ? doesOcMatchTurma(o, drawerTurmaObj)
                : String(o.turma || '').toLowerCase() === quickDrawer.turmaNome.toLowerCase()
            )
            .sort((a, b) => (b.createdAt || b.data || '').localeCompare(a.createdAt || a.data || ''))
        : []

    const drawerStatusOcorrencias =
      quickDrawer?.type === 'status'
        ? ocorrencias
            .filter(o =>
              quickDrawer.statusFilter === 'todas'
                ? true
                : quickDrawer.statusFilter === 'pendentes'
                  ? !o.ciencia_responsavel
                  : o.ciencia_responsavel
            )
            .sort((a, b) => (b.createdAt || b.data || '').localeCompare(a.createdAt || a.data || ''))
        : []

    return (
      <dialog
        ref={drawerDialogRef}
        {...({ closedby: 'any' } as any)}
        aria-labelledby="quickDrawerTitle"
        style={{
          position: 'fixed',
          inset: '0 0 0 auto',
          margin: 0,
          padding: 0,
          width: '100%',
          maxWidth: '580px',
          height: '100dvh',
          maxHeight: '100dvh',
          border: 'none',
          borderLeft: '1px solid rgba(226, 232, 240, 0.9)',
          background: '#ffffff',
          boxShadow: '-24px 0 60px -12px rgba(15, 23, 42, 0.22)',
          zIndex: 2200,
          display: quickDrawer ? 'flex' : 'none',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {quickDrawer?.type === 'ocorrencia' && activeOc && (
          <>
            {(() => {
              const isConfirmed = Boolean(activeOc.ciencia_responsavel)
              const parsed = parseOcorrenciaDescricao(activeOc.descricao)
              const turmaLabel = activeOc.turmaNome || activeOc.turma || 'Sem turma'
              const aId = cleanAlunoId(activeOc.alunoId || activeOc.aluno_id)
              const totalDoAluno = ocorrencias.filter(o => cleanAlunoId(o.alunoId || o.aluno_id) === aId).length

              return (
                <>
                  {/* Header do Drawer de Ocorrência */}
                  <div
                    style={{
                      padding: '24px 28px',
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'Outfit, sans-serif',
                            fontWeight: 900,
                            fontSize: 16,
                            color: '#fff',
                          }}
                        >
                          {getInitials(activeOc.alunoNome || 'AL')}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                color: '#93c5fd',
                              }}
                            >
                              Detalhes do Registro
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 20,
                                fontSize: 10.5,
                                fontWeight: 700,
                                background: isConfirmed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.25)',
                                color: isConfirmed ? '#6ee7b7' : '#fcd34d',
                              }}
                            >
                              {isConfirmed ? '✓ Ciência Confirmada' : '⏳ Aguardando Ciência'}
                            </span>
                          </div>
                          <h2
                            id="quickDrawerTitle"
                            style={{
                              fontFamily: 'Outfit, sans-serif',
                              fontWeight: 900,
                              fontSize: 20,
                              margin: 0,
                              color: '#fff',
                            }}
                          >
                            {activeOc.alunoNome}
                          </h2>
                          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                            {turmaLabel} • Data: {formatDateBR(activeOc.data)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuickDrawer(null)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Botão rápido para ver todo o dossiê do aluno */}
                    <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setQuickDrawer({
                            type: 'aluno',
                            alunoId: aId,
                            alunoNome: activeOc.alunoNome,
                            turma: turmaLabel,
                          })
                        }
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.18)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <User size={13} /> Ver Dossiê Completo do Aluno ({totalDoAluno} registro{totalDoAluno !== 1 ? 's' : ''}) →
                      </button>
                    </div>
                  </div>

                  {/* Corpo do Drawer de Ocorrência */}
                  <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Metadados Rápidos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          Data da Ocorrência
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={15} style={{ color: '#2563eb' }} />
                          {formatDateBR(activeOc.data)}
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          Responsável Pedagógico
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={15} style={{ color: '#2563eb' }} />
                          {activeOc.responsavel || 'Não informado'}
                        </div>
                      </div>
                    </div>

                    {/* Descrição Completa */}
                    <div
                      style={{
                        padding: '18px 20px',
                        borderRadius: 16,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#475569',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: 10,
                        }}
                      >
                        Relato Pedagógico / Descrição
                      </div>
                      <div
                        style={{
                          fontSize: 14.5,
                          color: '#1e293b',
                          lineHeight: 1.65,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {parsed.textoLimpo}
                      </div>
                    </div>

                    {/* Anexo se existir */}
                    {activeOc.anexoUrl && (
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: 14,
                          background: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: '#e0f2fe',
                              color: '#0284c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Paperclip size={18} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#0c4a6e',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {activeOc.anexoNome || 'Documento Anexo'}
                            </div>
                            <div style={{ fontSize: 11, color: '#0369a1' }}>Clique para visualizar o arquivo em nova aba</div>
                          </div>
                        </div>
                        <a
                          href={activeOc.anexoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '8px 14px',
                            borderRadius: 10,
                            background: '#0284c7',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            flexShrink: 0,
                          }}
                        >
                          Abrir <ExternalLink size={13} />
                        </a>
                      </div>
                    )}

                    {/* Trilha de Auditoria */}
                    {(parsed.lancado || parsed.editado || parsed.confirmado) && (
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: 14,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Histórico de Auditoria
                        </div>
                        {parsed.lancado && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                            <Clock size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
                            <span>
                              Registrado por <strong>{parsed.lancado}</strong>
                            </span>
                          </div>
                        )}
                        {parsed.editado && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                            <Pencil size={13} style={{ color: '#059669', flexShrink: 0 }} />
                            <span>
                              Editado por <strong>{parsed.editado}</strong>
                            </span>
                          </div>
                        )}
                        {parsed.confirmado && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                            <CheckCircle size={13} style={{ color: '#059669', flexShrink: 0 }} />
                            <span>
                              Ciência confirmada por <strong>{parsed.confirmado}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer de Ações Diretas */}
                  <div
                    style={{
                      padding: '16px 28px',
                      borderTop: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEdit(activeOc.id)}
                        style={{
                          height: 38,
                          padding: '0 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#0f172a',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => printSingleOcorrencia(activeOc)}
                        style={{
                          height: 38,
                          padding: '0 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#0f172a',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Printer size={14} /> Imprimir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(activeOc.id)}
                        style={{
                          height: 38,
                          width: 38,
                          borderRadius: 10,
                          border: '1px solid #fecaca',
                          background: '#fff',
                          color: '#ef4444',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Excluir ocorrência"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {isConfirmed ? (
                      <button
                        type="button"
                        onClick={() => desfazerCiencia(activeOc.id)}
                        style={{
                          height: 38,
                          padding: '0 16px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#475569',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Undo size={14} /> Desfazer Ciência
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => marcarCiencia(activeOc.id)}
                        style={{
                          height: 38,
                          padding: '0 18px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          color: '#fff',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <CheckCircle size={15} /> Confirmar Ciência
                      </button>
                    )}
                  </div>
                </>
              )
            })()}
          </>
        )}

        {quickDrawer?.type === 'aluno' && (
          <>
            <div
              style={{
                padding: '24px 28px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Outfit, sans-serif',
                      fontWeight: 900,
                      fontSize: 16,
                    }}
                  >
                    {getInitials(quickDrawer.alunoNome)}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: '#93c5fd',
                        marginBottom: 2,
                      }}
                    >
                      Dossiê Disciplinar do Aluno
                    </div>
                    <h2
                      id="quickDrawerTitle"
                      style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 20, margin: 0, color: '#fff' }}
                    >
                      {quickDrawer.alunoNome}
                    </h2>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                      {quickDrawer.turma} • {drawerAlunoOcorrencias.length} ocorrência(s)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickDrawer(null)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.12)',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Total: {drawerAlunoOcorrencias.length}
                </span>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'rgba(245, 158, 11, 0.25)',
                    color: '#fde68a',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Aguardando: {drawerAlunoOcorrencias.filter(o => !o.ciencia_responsavel).length}
                </span>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'rgba(16, 185, 129, 0.25)',
                    color: '#a7f3d0',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Confirmadas: {drawerAlunoOcorrencias.filter(o => o.ciencia_responsavel).length}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    openNew({
                      alunoId: quickDrawer.alunoId,
                      alunoNome: quickDrawer.alunoNome,
                      turma: quickDrawer.turma,
                    })
                  }
                  style={{
                    marginLeft: 'auto',
                    padding: '5px 12px',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#1e3a8a',
                    border: 'none',
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Plus size={13} /> Nova p/ Aluno
                </button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {drawerAlunoOcorrencias.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  Nenhuma ocorrência registrada para este aluno.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {drawerAlunoOcorrencias.map(oc => renderOcorrenciaCard(oc, { compact: true, showTurmaBadge: false }))}
                </div>
              )}
            </div>
          </>
        )}

        {quickDrawer?.type === 'turma' && (
          <>
            <div
              style={{
                padding: '24px 28px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: '#93c5fd',
                      marginBottom: 4,
                    }}
                  >
                    Visualização Rápida da Turma
                  </div>
                  <h2
                    id="quickDrawerTitle"
                    style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 20, margin: 0, color: '#fff' }}
                  >
                    {quickDrawer.turmaNome}
                  </h2>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                    {drawerTurmaOcorrencias.length} ocorrência(s) registrada(s) nesta turma
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickDrawer(null)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    const tName = quickDrawer.turmaNome
                    setQuickDrawer(null)
                    setTurmaSel(tName)
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Abrir Painel Completo da Turma <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => openNew({ turma: quickDrawer.turmaNome })}
                  style={{
                    marginLeft: 'auto',
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#1e3a8a',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Plus size={13} /> Nova Ocorrência
                </button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {drawerTurmaOcorrencias.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                  <CheckCircle size={36} style={{ color: '#10b981', margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Nenhuma ocorrência nesta turma</div>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Todos os alunos desta turma estão sem registros disciplinares.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {drawerTurmaOcorrencias.map(oc => renderOcorrenciaCard(oc, { compact: true, showTurmaBadge: false }))}
                </div>
              )}
            </div>
          </>
        )}

        {quickDrawer?.type === 'status' && (
          <>
            <div
              style={{
                padding: '24px 28px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: '#93c5fd',
                      marginBottom: 4,
                    }}
                  >
                    Filtro Instantâneo
                  </div>
                  <h2
                    id="quickDrawerTitle"
                    style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 20, margin: 0, color: '#fff' }}
                  >
                    {quickDrawer.statusFilter === 'pendentes'
                      ? 'Ocorrências Aguardando Ciência'
                      : quickDrawer.statusFilter === 'confirmadas'
                        ? 'Ocorrências com Ciência Confirmada'
                        : 'Todas as Ocorrências'}
                  </h2>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                    {drawerStatusOcorrencias.length} registro(s) encontrado(s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickDrawer(null)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {drawerStatusOcorrencias.map(oc => renderOcorrenciaCard(oc, { compact: true }))}
              </div>
            </div>
          </>
        )}
      </dialog>
    )
  }

  // ── HOME: Dashboard Pedagógico & Visões Diretas ───────────────────────────
  if (!turmaSel) {
    return (
      <div
        className="ocorrencias-page-container"
        style={{
          padding: '28px 32px 48px',
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          minHeight: '100vh',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header Executivo Ultra Moderno */}
        <div
          className="ocorrencias-header"
          style={{
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.16)',
                marginBottom: '8px',
              }}
            >
              <Sparkles size={13} style={{ color: '#2563eb' }} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#2563eb',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}
              >
                Gestão Disciplinar
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 900,
                fontSize: 30,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.6px',
              }}
            >
              Ocorrências Escolares
            </h1>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: '4px 0 0 0' }}>
              Monitore o comportamento, acompanhe ciências e clique em qualquer indicador para inspecionar os registros.
            </p>
          </div>

          <div
            className="ocorrencias-header-toggle"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
          >
            {/* Segmented Switcher de 3 Modos */}
            <div
              style={{
                display: 'flex',
                background: '#ffffff',
                padding: '4px',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
              }}
            >
              <button
                type="button"
                onClick={() => setModoHome('turma')}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  background: modoHome === 'turma' ? 'linear-gradient(135deg, #1e40af, #2563eb)' : 'transparent',
                  color: modoHome === 'turma' ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  boxShadow: modoHome === 'turma' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                }}
              >
                <Users size={15} />
                <span>Por Turma</span>
              </button>

              <button
                type="button"
                onClick={() => setModoHome('registros')}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  background: modoHome === 'registros' ? 'linear-gradient(135deg, #1e40af, #2563eb)' : 'transparent',
                  color: modoHome === 'registros' ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  boxShadow: modoHome === 'registros' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                }}
              >
                <Layers size={15} />
                <span>Registros Diretos</span>
                <span
                  style={{
                    padding: '1px 7px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: modoHome === 'registros' ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
                    color: modoHome === 'registros' ? '#fff' : '#334155',
                  }}
                >
                  {totalOC}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModoHome('aluno')}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  background: modoHome === 'aluno' ? 'linear-gradient(135deg, #1e40af, #2563eb)' : 'transparent',
                  color: modoHome === 'aluno' ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  boxShadow: modoHome === 'aluno' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                }}
              >
                <Search size={15} />
                <span>Por Aluno</span>
              </button>
            </div>

            {/* Botão Global de Nova Ocorrência */}
            <button
              type="button"
              onClick={() => openNew()}
              style={{
                height: '44px',
                padding: '0 20px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.25)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Plus size={16} />
              <span>Nova Ocorrência</span>
            </button>
          </div>
        </div>

        {/* Banner Interativo de Ocorrências Aguardando Ciência */}
        {pendentes > 0 && (
          <div
            onClick={() => jumpToDirectRecords('pendentes')}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') jumpToDirectRecords('pendentes')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 22px',
              background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(254, 243, 199, 0.65) 100%)',
              border: '1px solid #fde68a',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '18px',
              marginBottom: '24px',
              cursor: 'pointer',
              boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.12)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -4px rgba(245, 158, 11, 0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px -4px rgba(245, 158, 11, 0.12)'
            }}
          >
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.16)',
                color: '#d97706',
                width: 44,
                height: 44,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e', fontFamily: 'Outfit, sans-serif' }}>
                {pendentes} ocorrência{pendentes > 1 ? 's' : ''} aguardando ciência dos responsáveis
              </div>
              <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 2 }}>
                Clique aqui para visualizar os registros pendentes diretamente e confirmar o alinhamento com as famílias.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setQuickDrawer({ type: 'status', statusFilter: 'pendentes' })
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#92400e',
                  background: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid #fcd34d',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Eye size={14} /> Gaveta Rápida
              </button>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 4px 10px rgba(217, 119, 6, 0.25)',
                }}
              >
                Ver Pendências <ChevronRight size={14} />
              </span>
            </div>
          </div>
        )}

        {/* Painel Executivo em 3 Colunas (100% Clicável) */}
        <div
          className="ocorrencias-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
            marginBottom: 28,
          }}
        >
          {/* Card 1: Status de Ciência Interativo */}
          <div
            style={{
              background: '#ffffff',
              padding: '22px 24px',
              borderRadius: '20px',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minWidth: 0,
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BarChart size={16} />
                  </div>
                  <span>Status de Ciência</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#2563eb',
                    background: '#eff6ff',
                    padding: '3px 10px',
                    borderRadius: 20,
                  }}
                >
                  {totalOC} total
                </span>
              </div>

              {isLoadingOcorrencias ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...Array(2)].map((_, i) => (
                    <div key={i}>
                      <Skeleton w="60%" h="12px" style={{ marginBottom: 6 }} />
                      <Skeleton w="100%" h="8px" />
                    </div>
                  ))}
                </div>
              ) : totalOC === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                  Sem ocorrências registradas
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Botão clicável: Ciência Confirmada */}
                  <button
                    type="button"
                    onClick={() => jumpToDirectRecords('confirmadas')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#ecfdf5'
                      e.currentTarget.style.borderColor = '#a7f3d0'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={13} /> Ciência Confirmada
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {confirmadas} ({totalOC ? Math.round((confirmadas / totalOC) * 100) : 0}%)
                        <ChevronRight size={13} style={{ color: '#94a3b8' }} />
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${totalOC ? (confirmadas / totalOC) * 100 : 0}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: 'linear-gradient(90deg, #10b981, #059669)',
                        }}
                      />
                    </div>
                  </button>

                  {/* Botão clicável: Aguardando Ciência */}
                  <button
                    type="button"
                    onClick={() => jumpToDirectRecords('pendentes')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#fffbeb'
                      e.currentTarget.style.borderColor = '#fde68a'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={13} /> Aguardando Ciência
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {pendentes} ({totalOC ? Math.round((pendentes / totalOC) * 100) : 0}%)
                        <ChevronRight size={13} style={{ color: '#94a3b8' }} />
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${totalOC ? (pendentes / totalOC) * 100 : 0}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                        }}
                      />
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => jumpToDirectRecords('todas')}
              style={{
                marginTop: 14,
                width: '100%',
                height: 36,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#2563eb',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
            >
              <span>Ver todos os {totalOC} registros diretamente</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Card 2: Alunos Reincidentes (100% Clicável -> abre Dossiê do Aluno) */}
          <div
            style={{
              background: '#ffffff',
              padding: '22px 24px',
              borderRadius: '20px',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: '#fef2f2',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldAlert size={16} />
                </div>
                <span>Alunos Reincidentes</span>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Clique p/ abrir</span>
            </div>

            {isLoadingOcorrencias ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Skeleton w="26px" h="26px" borderRadius="8px" />
                    <div style={{ flex: 1 }}>
                      <Skeleton w="65%" h="12px" style={{ marginBottom: 4 }} />
                      <Skeleton w="40%" h="10px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reincidentes.length === 0 ? (
              <div style={{ fontSize: 13, color: '#10b981', textAlign: 'center', padding: '24px 0', fontWeight: 600 }}>
                ✓ Nenhum reincidente registrado
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reincidentes.slice(0, 5).map((r, i) => (
                  <button
                    key={`${r.id || 'aluno'}-${i}`}
                    type="button"
                    onClick={() =>
                      setQuickDrawer({
                        type: 'aluno',
                        alunoId: r.id,
                        alunoNome: r.nome,
                        turma: r.turma,
                      })
                    }
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      background: i === 0 ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                      borderRadius: 12,
                      border: i === 0 ? '1px solid rgba(239, 68, 68, 0.14)' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = i === 0 ? 'rgba(239, 68, 68, 0.04)' : 'transparent'
                      e.currentTarget.style.borderColor = i === 0 ? 'rgba(239, 68, 68, 0.14)' : 'transparent'
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: i === 0 ? '#ef4444' : '#f1f5f9',
                        color: i === 0 ? '#fff' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}º
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.nome}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{r.turma}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: r.count >= 3 ? '#fef2f2' : '#fffbeb',
                          color: r.count >= 3 ? '#ef4444' : '#d97706',
                          fontSize: 12,
                          fontWeight: 800,
                          fontFamily: 'Outfit, sans-serif',
                        }}
                      >
                        {r.count} oc.
                      </span>
                      <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Registro Recente (100% Clicável -> abre Detalhes da Ocorrência) */}
          <div
            style={{
              background: '#ffffff',
              padding: '22px 24px',
              borderRadius: '20px',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: '#ecfdf5',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Calendar size={16} />
                </div>
                <span>Registro Recente</span>
              </div>
              <button
                type="button"
                onClick={() => jumpToDirectRecords('todas')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#2563eb',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ver todos →
              </button>
            </div>

            {isLoadingOcorrencias ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} w="100%" h="36px" borderRadius="8px" />
                ))}
              </div>
            ) : ultimasOC.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>Sem registros</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ultimasOC.map((oc, idx) => {
                  const isConfirmed = Boolean(oc.ciencia_responsavel)
                  return (
                    <button
                      key={oc.id || idx}
                      type="button"
                      onClick={() => setQuickDrawer({ type: 'ocorrencia', ocorrenciaId: oc.id })}
                      style={{
                        width: '100%',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: 12,
                        background: 'transparent',
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#f8fafc'
                        e.currentTarget.style.borderColor = '#e2e8f0'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = 'transparent'
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isConfirmed ? '#10b981' : '#f59e0b',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {oc.alunoNome}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {oc.turmaNome || oc.turma || 'Turma'} • {formatDateBR(oc.data)}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 20,
                          background: isConfirmed ? '#ecfdf5' : '#fffbeb',
                          color: isConfirmed ? '#059669' : '#b45309',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {isConfirmed ? 'Confirmada' : 'Aguardando'}
                      </span>
                      <ChevronRight size={14} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CONTEÚDO PRINCIPAL CONFORME O MODO SELECIONADO ── */}
        <div ref={registrosSectionRef}>
          {/* MODO 1: POR TURMA (Tabela Inteligente + Gaveta Rápida) */}
          {modoHome === 'turma' && (
            <>
              <div
                className="ocorrencias-filter-bar"
                style={{
                  background: '#ffffff',
                  padding: '18px 22px',
                  borderRadius: '18px',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  boxShadow: '0 4px 16px -4px rgba(15, 23, 42, 0.03)',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Linha superior: Pílulas rápidas + ordenação */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setFiltroTurmasRapido('todas')}
                      style={{
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 20,
                        border: filtroTurmasRapido === 'todas' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        background: filtroTurmasRapido === 'todas' ? '#eff6ff' : '#f8fafc',
                        color: filtroTurmasRapido === 'todas' ? '#1d4ed8' : '#475569',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Todas as Turmas ({turmas.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTurmasRapido('com_ocorrencias')}
                      style={{
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 20,
                        border: filtroTurmasRapido === 'com_ocorrencias' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        background: filtroTurmasRapido === 'com_ocorrencias' ? '#eff6ff' : '#f8fafc',
                        color: filtroTurmasRapido === 'com_ocorrencias' ? '#1d4ed8' : '#475569',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Com Ocorrências ({countTurmasComOc})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTurmasRapido('com_pendencias')}
                      style={{
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 20,
                        border: filtroTurmasRapido === 'com_pendencias' ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                        background: filtroTurmasRapido === 'com_pendencias' ? '#fffbeb' : '#f8fafc',
                        color: filtroTurmasRapido === 'com_pendencias' ? '#b45309' : '#475569',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Com Pendências ({countTurmasComPend})
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setOrdenarTurmasPorOcorrencias(v => !v)}
                      style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        background: ordenarTurmasPorOcorrencias ? '#f0fdf4' : '#fff',
                        color: ordenarTurmasPorOcorrencias ? '#15803d' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      title="Quando ativo, exibe primeiro as turmas com ocorrências pendentes ou ativas"
                    >
                      <ArrowUpDown size={13} />
                      {ordenarTurmasPorOcorrencias ? 'Priorizando turmas c/ registros' : 'Ordem padrão'}
                    </button>
                    {isFetchingOcorrencias && <UpdatingIndicator />}
                  </div>
                </div>

                {/* Linha inferior: Busca + Selects */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: '1 1 240px' }}>
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      className="form-input"
                      style={{
                        width: '100%',
                        paddingLeft: 40,
                        height: '42px',
                        borderRadius: '10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '13.5px',
                      }}
                      placeholder="Buscar turma por nome ou série..."
                      value={buscaTurmaTexto}
                      onChange={e => setBuscaTurmaTexto(e.target.value)}
                    />
                  </div>

                  <div style={{ width: '200px' }}>
                    {isLoadingTurmas ? (
                      <Skeleton w="100%" h="42px" />
                    ) : (
                      <select
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '42px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '13.5px',
                        }}
                        value={filtroBuscaHome}
                        onChange={e => setFiltroBuscaHome(e.target.value)}
                      >
                        <option value="">Todas as Séries</option>
                        {seriesDisponiveis.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{ width: '140px' }}>
                    {cfgCalendarioLetivo.length === 0 ? (
                      <Skeleton w="100%" h="42px" />
                    ) : (
                      <select
                        className="form-input"
                        style={{
                          height: '42px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '13.5px',
                        }}
                        value={filtroAno}
                        onChange={e => setFiltroAno(e.target.value)}
                      >
                        <option value="todos">Anos Letivos</option>
                        {cfgCalendarioLetivo.map((c: any) => (
                          <option key={c.id} value={c.ano}>
                            {c.ano}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{ width: '160px' }}>
                    {cfgNiveisEnsino.length === 0 ? (
                      <Skeleton w="100%" h="42px" />
                    ) : (
                      <select
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '42px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '13.5px',
                        }}
                        value={filtroSeg}
                        onChange={e => setFiltroSeg(e.target.value)}
                      >
                        <option value="todos">Segmentos</option>
                        {cfgNiveisEnsino.map((n: any) => (
                          <option key={n.id} value={n.nome}>
                            {n.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
                    Exibindo <strong style={{ color: '#0f172a' }}>{turmasComMetricas.length}</strong> turmas
                  </div>
                </div>
              </div>

              {/* Tabela Responsiva de Turmas (com clique direto para ver registros!) */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px 24px',
                  borderRadius: '20px',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)',
                  overflow: 'hidden',
                }}
              >
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Tabela de turmas e ocorrências disciplinares"
                  style={{
                    overflowX: 'auto',
                    maxInlineSize: '100%',
                    containerType: 'inline-size',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                    <thead style={{ position: 'sticky', insetBlockStart: 0, zIndex: 1, background: '#f8fafc' }}>
                      <tr>
                        <th
                          style={{
                            textAlign: 'left',
                            padding: '12px 16px',
                            fontSize: '11.5px',
                            color: '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            borderTopLeftRadius: 10,
                            borderBottomLeftRadius: 10,
                          }}
                        >
                          Turma
                        </th>
                        <th
                          style={{
                            textAlign: 'left',
                            padding: '12px',
                            fontSize: '11.5px',
                            color: '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                          }}
                        >
                          Segmento
                        </th>
                        <th
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            fontSize: '11.5px',
                            color: '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                          }}
                        >
                          Alunos
                        </th>
                        <th
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            fontSize: '11.5px',
                            color: '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                          }}
                        >
                          Ocorrências
                        </th>
                        <th
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            fontSize: '11.5px',
                            color: '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                          }}
                        >
                          Pendentes
                        </th>
                        <th
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            fontSize: '11.5px',
                            color: '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                          }}
                        >
                          Confirmadas
                        </th>
                        <th
                          style={{
                            textAlign: 'right',
                            padding: '12px 16px',
                            fontSize: '11.5px',
                            color: '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            borderTopRightRadius: 10,
                            borderBottomRightRadius: 10,
                          }}
                        >
                          Ações Rápidas
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingTurmas ? (
                        <TableSkeleton rows={5} cols={7} />
                      ) : turmasComMetricas.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <BookOpen size={32} style={{ color: '#94a3b8' }} />
                              <span style={{ fontSize: '14px', fontWeight: 600 }}>Nenhuma turma encontrada para este filtro</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        turmasComMetricas.map((turma: any) => {
                          const hasOc = turma.totalOc > 0
                          const isUrgent = turma.pendTurma > 0

                          return (
                            <tr
                              key={turma.id}
                              onClick={() => setQuickDrawer({ type: 'turma', turmaNome: turma.nome })}
                              style={{
                                background: '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                              title="Clique para inspecionar rapidamente as ocorrências desta turma"
                            >
                              <th
                                scope="row"
                                style={{
                                  textAlign: 'left',
                                  padding: '14px 16px',
                                  borderTop: '1px solid #f1f5f9',
                                  borderBottom: '1px solid #f1f5f9',
                                  borderLeft: isUrgent ? '3px solid #f59e0b' : hasOc ? '3px solid #3b82f6' : '1px solid #f1f5f9',
                                  borderTopLeftRadius: '12px',
                                  borderBottomLeftRadius: '12px',
                                  background: 'inherit',
                                }}
                              >
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{turma.nome}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                                  {turma.serie} • {turma.turno}
                                </div>
                              </th>
                              <td style={{ padding: '12px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>{turma.serie}</span>
                              </td>
                              <td
                                style={{
                                  padding: '12px',
                                  textAlign: 'center',
                                  borderTop: '1px solid #f1f5f9',
                                  borderBottom: '1px solid #f1f5f9',
                                }}
                              >
                                <span style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>{turma.alunosTurma}</span>
                              </td>
                              <td
                                style={{
                                  padding: '12px',
                                  textAlign: 'center',
                                  borderTop: '1px solid #f1f5f9',
                                  borderBottom: '1px solid #f1f5f9',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    minWidth: 28,
                                    padding: '3px 8px',
                                    borderRadius: 20,
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: hasOc ? '#1e40af' : '#94a3b8',
                                    background: hasOc ? '#eff6ff' : 'transparent',
                                  }}
                                >
                                  {turma.totalOc}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: '12px',
                                  textAlign: 'center',
                                  borderTop: '1px solid #f1f5f9',
                                  borderBottom: '1px solid #f1f5f9',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    minWidth: 28,
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: turma.pendTurma > 0 ? '#b45309' : '#94a3b8',
                                    background: turma.pendTurma > 0 ? '#fef3c7' : 'transparent',
                                    padding: turma.pendTurma > 0 ? '3px 8px' : '0',
                                    borderRadius: '20px',
                                  }}
                                >
                                  {turma.pendTurma}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: '12px',
                                  textAlign: 'center',
                                  borderTop: '1px solid #f1f5f9',
                                  borderBottom: '1px solid #f1f5f9',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    minWidth: 28,
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: turma.confTurma > 0 ? '#059669' : '#94a3b8',
                                    background: turma.confTurma > 0 ? '#ecfdf5' : 'transparent',
                                    padding: turma.confTurma > 0 ? '3px 8px' : '0',
                                    borderRadius: '20px',
                                  }}
                                >
                                  {turma.confTurma}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: '12px 16px',
                                  textAlign: 'right',
                                  borderTop: '1px solid #f1f5f9',
                                  borderBottom: '1px solid #f1f5f9',
                                  borderRight: '1px solid #f1f5f9',
                                  borderTopRightRadius: '12px',
                                  borderBottomRightRadius: '12px',
                                }}
                                onClick={e => e.stopPropagation()}
                              >
                                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                                  {hasOc && (
                                    <button
                                      type="button"
                                      onClick={() => setQuickDrawer({ type: 'turma', turmaNome: turma.nome })}
                                      style={{
                                        height: '32px',
                                        padding: '0 10px',
                                        background: isUrgent ? '#fffbeb' : '#eff6ff',
                                        border: isUrgent ? '1px solid #fde68a' : '1px solid #bfdbfe',
                                        borderRadius: '8px',
                                        color: isUrgent ? '#b45309' : '#2563eb',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Eye size={13} /> Ver ({turma.totalOc})
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTurmaSel(turma.nome)
                                      setFiltroStatus('todas')
                                      setBusca('')
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#475569',
                                      fontWeight: 700,
                                      fontSize: '12.5px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                    }}
                                  >
                                    Painel <ChevronRight size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openNew({ turma: turma.nome })}
                                    style={{
                                      height: '32px',
                                      padding: '0 12px',
                                      background: '#2563eb',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <Plus size={13} /> Nova
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* MODO 2: REGISTROS DIRETOS (Feed Completo de Ocorrências da Escola) */}
          {modoHome === 'registros' && (
            <div>
              <div
                style={{
                  background: '#ffffff',
                  padding: '18px 22px',
                  borderRadius: '18px',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  boxShadow: '0 4px 16px -4px rgba(15, 23, 42, 0.03)',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(
                      [
                        { id: 'todas', label: `Todas (${totalOC})`, activeBg: '#eff6ff', activeColor: '#1d4ed8', border: '#bfdbfe' },
                        {
                          id: 'pendentes',
                          label: `Aguardando Ciência (${pendentes})`,
                          activeBg: '#fffbeb',
                          activeColor: '#b45309',
                          border: '#fde68a',
                        },
                        {
                          id: 'confirmadas',
                          label: `Confirmadas (${confirmadas})`,
                          activeBg: '#ecfdf5',
                          activeColor: '#059669',
                          border: '#a7f3d0',
                        },
                        { id: 'anexo', label: `Com Anexo (${comAnexo})`, activeBg: '#f5f3ff', activeColor: '#6d28d9', border: '#ddd6fe' },
                      ] as const
                    ).map(tab => {
                      const active = filtroStatusDireto === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setFiltroStatusDireto(tab.id)}
                          style={{
                            height: 36,
                            padding: '0 14px',
                            borderRadius: 20,
                            border: `1px solid ${active ? tab.border : '#e2e8f0'}`,
                            background: active ? tab.activeBg : '#f8fafc',
                            color: active ? tab.activeColor : '#475569',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>

                  <span style={{ fontSize: 13, color: '#64748b' }}>
                    Mostrando <strong style={{ color: '#0f172a' }}>{ocorrenciasDiretasFiltradas.length}</strong> registro(s)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: '1 1 280px' }}>
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      className="form-input"
                      style={{
                        width: '100%',
                        paddingLeft: 40,
                        height: 42,
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: 13.5,
                      }}
                      placeholder="Buscar por nome do aluno, descrição, turma ou responsável..."
                      value={buscaDireta}
                      onChange={e => setBuscaDireta(e.target.value)}
                    />
                  </div>

                  <div style={{ width: 240 }}>
                    <select
                      className="form-input"
                      style={{
                        width: '100%',
                        height: 42,
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: 13.5,
                      }}
                      value={filtroTurmaDireta}
                      onChange={e => setFiltroTurmaDireta(e.target.value)}
                    >
                      <option value="todas">Todas as Turmas</option>
                      {turmas.map((t: any) => (
                        <option key={t.id} value={t.nome}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {ocorrenciasDiretasFiltradas.length === 0 ? (
                <div
                  style={{
                    background: '#fff',
                    padding: '48px 24px',
                    borderRadius: 20,
                    border: '1px solid #e2e8f0',
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  <CheckCircle size={36} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Nenhum registro encontrado</div>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Tente ajustar os filtros de status ou termo de busca.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ocorrenciasDiretasPaginadas.map(oc => renderOcorrenciaCard(oc))}

                  {/* Paginação Direta */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 8,
                      background: '#fff',
                      padding: '12px 20px',
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      Página <strong>{paginaDireta}</strong> de{' '}
                      <strong>{Math.max(1, Math.ceil(ocorrenciasDiretasFiltradas.length / itemsPerPage))}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        disabled={paginaDireta === 1}
                        onClick={() => setPaginaDireta(p => Math.max(1, p - 1))}
                        style={{
                          height: 32,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          cursor: paginaDireta === 1 ? 'not-allowed' : 'pointer',
                          color: paginaDireta === 1 ? '#cbd5e1' : '#334155',
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={paginaDireta >= Math.ceil(ocorrenciasDiretasFiltradas.length / itemsPerPage)}
                        onClick={() =>
                          setPaginaDireta(p => Math.min(Math.ceil(ocorrenciasDiretasFiltradas.length / itemsPerPage), p + 1))
                        }
                        style={{
                          height: 32,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          cursor:
                            paginaDireta >= Math.ceil(ocorrenciasDiretasFiltradas.length / itemsPerPage)
                              ? 'not-allowed'
                              : 'pointer',
                          color:
                            paginaDireta >= Math.ceil(ocorrenciasDiretasFiltradas.length / itemsPerPage)
                              ? '#cbd5e1'
                              : '#334155',
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO 3: POR ALUNO (Dossiê Individual com sugestões imediatas) */}
          {modoHome === 'aluno' && (
            <div>
              {(() => {
                const filteredAlunos =
                  buscaAlunoHome.trim().length > 0
                    ? todosAlunosMapped
                        .filter((a: any) => a.nome.toLowerCase().includes(buscaAlunoHome.toLowerCase()))
                        .slice(0, 12)
                    : []
                const ocDoAluno = alunoSel
                  ? ocorrencias
                      .filter(o => cleanAlunoId(o.alunoId || o.aluno_id) === cleanAlunoId(alunoSel.id))
                      .sort((a, b) => (b.createdAt || b.data || '').localeCompare(a.createdAt || a.data || ''))
                  : []

                const printRelatorio = () => {
                  if (!alunoSel) return
                  const win = window.open('', '_blank')
                  if (!win) return
                  win.document.write(
                    `<html><head><title>Relatório de Ocorrências — ${alunoSel.nome}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1a1a2e}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0;font-weight:bold}</style></head><body>`
                  )
                  win.document.write(`<h1>Relatório de Ocorrências Disciplinares</h1>`)
                  win.document.write(
                    `<p><strong>Aluno:</strong> ${alunoSel.nome} | <strong>Turma:</strong> ${alunoSel.turma} | <strong>Total:</strong> ${ocDoAluno.length}</p>`
                  )
                  win.document.write(
                    `<table><thead><tr><th>Data</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`
                  )
                  ocDoAluno.forEach(o => {
                    const parsed = parseOcorrenciaDescricao(o.descricao)
                    win.document.write(
                      `<tr><td>${formatDateBR(o.data)}</td><td>${parsed.textoLimpo}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel ? 'Sim' : 'Não'}</td></tr>`
                    )
                  })
                  win.document.write(`</tbody></table></body></html>`)
                  win.document.close()
                  win.print()
                }

                return (
                  <>
                    {/* Busca de Aluno + Alunos com Ocorrências */}
                    <div
                      style={{
                        background: '#fff',
                        padding: '22px 24px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '20px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>
                          🔍 Buscar Dossiê Individual de Aluno
                        </div>
                        {alunoSel && (
                          <button
                            type="button"
                            onClick={() => {
                              setAlunoSel(null)
                              setBuscaAlunoHome('')
                            }}
                            style={{
                              border: 'none',
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '5px 12px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Trocar Aluno
                          </button>
                        )}
                      </div>

                      <div style={{ position: 'relative' }}>
                        <Search
                          size={18}
                          style={{
                            position: 'absolute',
                            left: 14,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#94a3b8',
                            pointerEvents: 'none',
                          }}
                        />
                        <input
                          className="form-input"
                          style={{
                            paddingLeft: 42,
                            height: '44px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            width: '100%',
                          }}
                          placeholder="Digite o nome de qualquer aluno ou selecione abaixo..."
                          value={buscaAlunoHome}
                          onChange={e => {
                            setBuscaAlunoHome(e.target.value)
                            setAlunoSel(null)
                          }}
                        />
                      </div>

                      {/* Quando não há busca digitada, mostra imediatamente todos os alunos que já possuem ocorrência */}
                      {!alunoSel && buscaAlunoHome.trim().length === 0 && reincidentes.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              marginBottom: 10,
                            }}
                          >
                            Alunos com ocorrências registradas ({reincidentes.length}) — Clique para ver
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                            {reincidentes.map(r => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setAlunoSel({ id: r.id, nome: r.nome, turma: r.turma })}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  padding: '12px',
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 12,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = '#eff6ff'
                                  e.currentTarget.style.borderColor = '#bfdbfe'
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = '#f8fafc'
                                  e.currentTarget.style.borderColor = '#e2e8f0'
                                }}
                              >
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    background: 'rgba(37, 99, 235, 0.1)',
                                    color: '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 13,
                                    fontWeight: 800,
                                    flexShrink: 0,
                                  }}
                                >
                                  {getInitials(r.nome)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: 13.5,
                                      fontWeight: 700,
                                      color: '#0f172a',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {r.nome}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                    {r.turma} • <strong>{r.count}</strong> registro(s)
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {isLoadingAlunos ? (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} w="100%" h="52px" borderRadius="12px" />
                          ))}
                        </div>
                      ) : (
                        filteredAlunos.length > 0 &&
                        !alunoSel && (
                          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                            {filteredAlunos.map((a: any) => {
                              const countOc = ocorrencias.filter(
                                o => cleanAlunoId(o.alunoId || o.aluno_id) === cleanAlunoId(a.id)
                              ).length
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => setAlunoSel(a)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '12px',
                                    background: '#fff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: 10,
                                      background: 'rgba(37, 99, 235, 0.1)',
                                      color: '#2563eb',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 13,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {getInitials(a.nome)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{a.nome}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>
                                      {a.turma || 'Sem turma'} • {countOc} ocorrência(s)
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      )}
                    </div>

                    {/* Histórico do aluno selecionado */}
                    {alunoSel && (
                      <div>
                        <div
                          style={{
                            background: '#fff',
                            padding: '22px 24px',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                            borderLeft: '4px solid #2563eb',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 14,
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 17,
                              fontWeight: 800,
                            }}
                          >
                            {getInitials(alunoSel.nome)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                              {alunoSel.nome}
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>
                              {alunoSel.turma} • {ocDoAluno.length} ocorrência(s) no histórico
                            </div>
                          </div>

                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                padding: '6px 12px',
                                borderRadius: 20,
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#2563eb',
                              }}
                            >
                              Total: {ocDoAluno.length}
                            </span>
                            <span
                              style={{
                                padding: '6px 12px',
                                borderRadius: 20,
                                background: '#fef3c7',
                                border: '1px solid #fde68a',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#b45309',
                              }}
                            >
                              Aguardando: {ocDoAluno.filter(o => !o.ciencia_responsavel).length}
                            </span>
                            <span
                              style={{
                                padding: '6px 12px',
                                borderRadius: 20,
                                background: '#dcfce7',
                                border: '1px solid #bbf7d0',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#15803d',
                              }}
                            >
                              Confirmadas: {ocDoAluno.filter(o => o.ciencia_responsavel).length}
                            </span>

                            <button
                              type="button"
                              onClick={printRelatorio}
                              style={{
                                height: 38,
                                padding: '0 14px',
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                color: '#0f172a',
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Printer size={14} /> Imprimir
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openNew({
                                  alunoId: alunoSel.id,
                                  alunoNome: alunoSel.nome,
                                  turma: alunoSel.turma,
                                })
                              }
                              style={{
                                height: 38,
                                padding: '0 14px',
                                background: '#2563eb',
                                border: 'none',
                                borderRadius: 10,
                                color: '#fff',
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Plus size={14} /> Nova p/ Aluno
                            </button>
                          </div>
                        </div>

                        {ocDoAluno.length === 0 ? (
                          <div
                            style={{
                              background: '#fff',
                              padding: '32px',
                              borderRadius: '16px',
                              border: '1px solid #e2e8f0',
                              textAlign: 'center',
                              color: '#10b981',
                              fontWeight: 600,
                            }}
                          >
                            ✓ Nenhuma ocorrência registrada para este aluno.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {ocDoAluno.map(oc => renderOcorrenciaCard(oc))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Slide-over Quick Drawer */}
        {renderQuickDrawer()}

        {/* Modal Criar/Editar */}
        {modalOpen && (
          <OcorrenciaModal
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onClose={() => setModalOpen(false)}
            alunosDaTurma={alunosDaTurmaAtual}
            todosAlunos={todosAlunosMapped}
            turmas={turmas}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
            isEditing={!!editingId}
          />
        )}

        {/* Modal Erros de Validação */}
        {isValidationModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(8px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              className="glass-card ultra-modal modal-enter-active shake-element"
              style={{
                width: '100%',
                maxWidth: 480,
                padding: 32,
                textAlign: 'center',
                position: 'relative',
                boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
                background: '#ffffff',
                borderRadius: '24px',
              }}
            >
              <button
                onClick={() => setIsValidationModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={16} />
              </button>

              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 18,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1.5px dashed rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                }}
              >
                <AlertTriangle size={26} color="#ef4444" />
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>
                Campos Obrigatórios Pendentes
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: '1.6', margin: '0 0 20px' }}>
                Por favor, preencha os campos destacados abaixo para concluir o registro.
              </p>

              <div
                style={{
                  textAlign: 'left',
                  background: '#f8fafc',
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                {validationErrors.map((err, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setIsValidationModalOpen(false)
                      const el = document.getElementsByName(err.field)[0] || document.getElementById(err.field)
                      if (el) (el as HTMLElement).focus()
                    }}
                    style={{
                      fontSize: 13,
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
                    <span>{err.label}</span>
                    <span style={{ fontSize: 11, color: '#2563eb', marginLeft: 'auto', fontWeight: 700 }}>Focar Campo →</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsValidationModalOpen(false)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 700,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vista interna: Ocorrências da Turma Selecionada ──────────────────────
  const turmaObj = turmas.find((t: any) => t.nome === turmaSel)
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'

  const printRelatorioTurma = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(
      `<html><head><title>Ocorrências — ${turmaSel}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0}</style></head><body>`
    )
    win.document.write(`<h1>Ocorrências — ${turmaSel}</h1><p>Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>`)
    win.document.write(
      `<table><thead><tr><th>Aluno</th><th>Data</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`
    )
    filtered.forEach(o => {
      const parsed = parseOcorrenciaDescricao(o.descricao)
      win.document.write(
        `<tr><td>${o.alunoNome}</td><td>${formatDateBR(o.data)}</td><td>${parsed.textoLimpo}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel ? 'Sim' : 'Não'}</td></tr>`
      )
    })
    win.document.write(`</tbody></table></body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            style={{
              border: '1px solid #e2e8f0',
              background: '#fff',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#0f172a',
            }}
            onClick={() => setTurmaSel(null)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, color: '#0f172a', margin: 0 }}>
                Ocorrências — {turmaSel}
              </h1>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: `${color}15`, color, fontSize: 11, fontWeight: 700 }}>
                {turmaObj?.serie}
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0 0' }}>
              {ocDaTurma.length} ocorrência(s) • {alunosDaTurmaAtual.length} alunos matriculados
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            style={{
              height: '42px',
              padding: '0 16px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              color: '#0f172a',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={printRelatorioTurma}
          >
            <Printer size={16} /> Relatório da Turma
          </button>
          <button
            style={{
              height: '42px',
              padding: '0 20px',
              background: 'linear-gradient(135deg, #1e40af, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
            onClick={() => openNew({ turma: turmaSel })}
          >
            <Plus size={16} /> Nova Ocorrência
          </button>
        </div>
      </div>

      {/* KPIs clicáveis da turma */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total na Turma', value: ocDaTurma.length, color: '#2563eb', status: 'todas' as const },
          {
            label: 'Aguardando Ciência',
            value: ocDaTurma.filter(o => !o.ciencia_responsavel).length,
            color: '#d97706',
            status: 'pendentes' as const,
          },
          {
            label: 'Ciência Confirmada',
            value: ocDaTurma.filter(o => o.ciencia_responsavel).length,
            color: '#059669',
            status: 'confirmadas' as const,
          },
          { label: 'Com Anexo', value: ocDaTurma.filter(o => !!o.anexoUrl).length, color: '#6366f1', status: 'todas' as const },
        ].map(c => (
          <button
            key={c.label}
            type="button"
            onClick={() => setFiltroStatus(c.status)}
            style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '16px',
              border: filtroStatus === c.status ? `1.5px solid ${c.color}` : '1px solid #e2e8f0',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: c.color, fontFamily: 'Outfit,sans-serif' }}>{c.value}</div>
          </button>
        ))}
      </div>

      {/* Filtros internos */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
          <input
            className="form-input"
            style={{ paddingLeft: 36, height: '42px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0' }}
            placeholder="Buscar aluno ou descrição..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', background: '#fff', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          {(['todas', 'pendentes', 'confirmadas'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              style={{
                height: '34px',
                padding: '0 14px',
                background:
                  filtroStatus === f ? (f === 'confirmadas' ? '#10b981' : f === 'pendentes' ? '#f59e0b' : '#2563eb') : 'transparent',
                color: filtroStatus === f ? '#fff' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {f === 'todas' ? 'Todas' : f === 'pendentes' ? 'Aguardando Ciência' : 'Confirmadas'}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>{filtered.length} resultados</span>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            background: '#fff',
            padding: '44px',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          {ocDaTurma.length === 0 ? (
            <>
              <CheckCircle size={36} style={{ margin: '0 auto 12px', color: '#10b981' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Nenhuma ocorrência nesta turma</div>
              <button
                style={{
                  marginTop: 16,
                  height: '40px',
                  padding: '0 18px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onClick={() => openNew({ turma: turmaSel })}
              >
                <Plus size={14} /> Nova Ocorrência
              </button>
            </>
          ) : (
            <div>Nenhuma ocorrência com os filtros aplicados.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {paginatedOcorrencias.map(oc => renderOcorrenciaCard(oc, { showTurmaBadge: false }))}

          {/* Paginação */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              background: '#fff',
              padding: '12px 20px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Mostrar:</span>
              <select
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
                style={{
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  background: '#f8fafc',
                  padding: '0 8px',
                }}
              >
                {[5, 10, 20, 50].map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '13px', color: '#64748b' }}>por página</span>
            </div>

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  height: '32px',
                  width: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  color: currentPage === 1 ? '#cbd5e1' : '#475569',
                }}
              >
                ‹
              </button>

              <span style={{ fontSize: '13px', color: '#475569', margin: '0 8px' }}>
                Página <strong>{currentPage}</strong> de <strong>{Math.ceil(filtered.length / itemsPerPage) || 1}</strong>
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filtered.length / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(filtered.length / itemsPerPage) || filtered.length === 0}
                style={{
                  height: '32px',
                  width: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor:
                    currentPage === Math.ceil(filtered.length / itemsPerPage) || filtered.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  color:
                    currentPage === Math.ceil(filtered.length / itemsPerPage) || filtered.length === 0
                      ? '#cbd5e1'
                      : '#475569',
                }}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Quick Drawer */}
      {renderQuickDrawer()}

      {modalOpen && (
        <OcorrenciaModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          alunosDaTurma={alunosDaTurmaAtual}
          todosAlunos={todosAlunosMapped}
          turmas={turmas}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
          isEditing={!!editingId}
        />
      )}
    </div>
  )
}
