'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FileSpreadsheet,
  Plus,
  Search,
  BarChart3,
  Edit3,
  Copy,
  Trash2,
  Link2,
  Check,
  UserPlus,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ListChecks,
  ExternalLink,
  ArrowLeft,
  Eye,
  Award,
  Lock,
  Filter,
  Globe,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import {
  GPForm,
  GPFormResponse,
  FORM_TEMPLATE_BLUEPRINTS,
  FORM_CATEGORIES,
  FormTemplateBlueprint,
} from '@/lib/gestao-pessoas/formulariosTypes'
import { FormBuilderStudio } from '@/components/gestao-pessoas/formularios/FormBuilderStudio'
import { FormRenderer } from '@/components/gestao-pessoas/formularios/FormRenderer'
import { stripHtmlToPlainText } from '@/components/gestao-pessoas/formularios/FormRichTextEditor'

export default function GestaoPessoasFormulariosPage() {
  const router = useRouter()
  const { currentUser } = useApp()

  const [forms, setForms] = useState<GPForm[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [colaboradoresList, setColaboradoresList] = useState<any[]>([])

  // Active View: 'list' | 'studio' | 'respond'
  const [viewMode, setViewMode] = useState<'list' | 'studio' | 'respond'>('list')
  const [selectedForm, setSelectedForm] = useState<GPForm | null>(null)
  const [selectedFormResponses, setSelectedFormResponses] = useState<GPFormResponse[]>([])
  const [initialStudioTab, setInitialStudioTab] = useState<
    'perguntas' | 'layout' | 'config' | 'preview' | 'respostas'
  >('perguntas')

  // Respond / Manual entry options
  const [respondManualMode, setRespondManualMode] = useState(false)
  const [editingResponse, setEditingResponse] = useState<GPFormResponse | null>(null)
  const [prefillColab, setPrefillColab] = useState<any | null>(null)

  // List filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusTab, setStatusTab] = useState<
    'todos' | 'ativos' | 'pendentes_mim' | 'respondidos_mim' | 'rascunhos' | 'encerrados'
  >('todos')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [creatingForm, setCreatingForm] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [formsRes, funcsRes] = await Promise.all([
        fetch('/api/gestao-pessoas/formularios', { cache: 'no-store' }),
        fetch('/api/rh/funcionarios?lightweight=true', { cache: 'no-store' }),
      ])

      if (formsRes.ok) {
        const data = await formsRes.json()
        setForms(Array.isArray(data.forms) ? data.forms : [])
        setIsAdmin(Boolean(data.isAdmin))
      }
      if (funcsRes.ok) {
        const funcs = await funcsRes.json()
        if (Array.isArray(funcs)) {
          setColaboradoresList(
            funcs.filter((f: any) => String(f.status || 'ativo').toLowerCase() !== 'inativo')
          )
        }
      }
    } catch (err) {
      console.error('Erro ao carregar formulários:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const openFormInStudio = async (
    formItem: GPForm,
    tab: 'perguntas' | 'layout' | 'config' | 'preview' | 'respostas' = 'perguntas'
  ) => {
    setInitialStudioTab(tab)
    setSelectedForm(formItem)
    setViewMode('studio')
    try {
      const res = await fetch(`/api/gestao-pessoas/formularios/${formItem.id}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.form) setSelectedForm(data.form)
        setSelectedFormResponses(Array.isArray(data.responses) ? data.responses : [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const openFormToRespond = (
    formItem: GPForm,
    manual = false,
    prefill?: any,
    editResp?: GPFormResponse | null
  ) => {
    setSelectedForm(formItem)
    setRespondManualMode(manual)
    setPrefillColab(prefill || null)
    setEditingResponse(
      editResp !== undefined
        ? editResp
        : !manual && formItem.myResponse && formItem.settings?.allowEditOwnResponse
        ? formItem.myResponse
        : null
    )
    setViewMode('respond')
  }

  const handleCreateFromBlueprint = async (blueprint: FormTemplateBlueprint) => {
    setCreatingForm(true)
    try {
      const res = await fetch('/api/gestao-pessoas/formularios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blueprint.form),
      })
      if (res.ok) {
        const created: GPForm = await res.json()
        setForms(prev => [created, ...prev])
        setIsTemplateModalOpen(false)
        setSelectedForm(created)
        setSelectedFormResponses([])
        setInitialStudioTab('perguntas')
        setViewMode('studio')
      }
    } catch (err) {
      alert('Erro ao criar formulário.')
    } finally {
      setCreatingForm(false)
    }
  }

  const handleDuplicateForm = async (formItem: GPForm) => {
    try {
      const clonePayload = {
        ...formItem,
        id: undefined,
        title: `${formItem.title} (Cópia)`,
        status: 'rascunho',
      }
      const res = await fetch('/api/gestao-pessoas/formularios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clonePayload),
      })
      if (res.ok) {
        const created: GPForm = await res.json()
        setForms(prev => [created, ...prev])
      }
    } catch (e) {
      alert('Erro ao duplicar formulário.')
    }
  }

  const handleDeleteForm = async (formId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este formulário e todas as suas respostas?')) {
      return
    }
    try {
      const res = await fetch(`/api/gestao-pessoas/formularios/${formId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setForms(prev => prev.filter(f => f.id !== formId))
      }
    } catch (e) {
      alert('Erro ao excluir formulário.')
    }
  }

  const handleSaveFormInStudio = async (updatedForm: GPForm) => {
    const res = await fetch(`/api/gestao-pessoas/formularios/${updatedForm.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedForm),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Erro ao salvar formulário no servidor.')
    }
    const saved = await res.json()
    setSelectedForm(saved)
    setForms(prev =>
      prev.map(f =>
        f.id === saved.id
          ? { ...saved, respostasCount: selectedFormResponses.length, myResponse: f.myResponse }
          : f
      )
    )
    return saved
  }

  const handleDeleteResponse = async (responseId: string) => {
    if (!selectedForm) return
    if (!window.confirm('Deseja realmente excluir esta resposta?')) return
    const res = await fetch(
      `/api/gestao-pessoas/formularios/${selectedForm.id}/respostas?responseId=${encodeURIComponent(
        responseId
      )}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      const nextList = selectedFormResponses.filter(r => r.id !== responseId)
      setSelectedFormResponses(nextList)
      setForms(prev =>
        prev.map(f =>
          f.id === selectedForm.id ? { ...f, respostasCount: nextList.length } : f
        )
      )
    }
  }

  const copyShareLink = (formId: string) => {
    const url = `${window.location.origin}/gestao-pessoas/formularios/${formId}`
    navigator.clipboard.writeText(url)
    setCopiedId(formId)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleToggleAllowWithoutModule = async (targetForm: GPForm) => {
    const nextVal = !targetForm.settings?.allowAccessWithoutModule
    const updatedForm: GPForm = {
      ...targetForm,
      settings: {
        ...targetForm.settings,
        allowAccessWithoutModule: nextVal,
      },
    }

    setForms(prev => prev.map(f => (f.id === targetForm.id ? updatedForm : f)))

    try {
      const res = await fetch(`/api/gestao-pessoas/formularios/${targetForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedForm),
      })
      if (!res.ok) {
        setForms(prev => prev.map(f => (f.id === targetForm.id ? targetForm : f)))
      }
    } catch {
      setForms(prev => prev.map(f => (f.id === targetForm.id ? targetForm : f)))
    }
  }

  // Stats
  const stats = useMemo(() => {
    const ativos = forms.filter(f => f.status === 'ativo').length
    const totalRespostas = forms.reduce((acc, f) => acc + (f.respostasCount || 0), 0)
    const pendentesParaMim = forms.filter(f => f.status === 'ativo' && !f.myResponse).length
    const respondidosPorMim = forms.filter(f => Boolean(f.myResponse)).length
    return { ativos, totalRespostas, pendentesParaMim, respondidosPorMim }
  }, [forms])

  const filteredForms = useMemo(() => {
    return forms.filter(f => {
      if (statusTab === 'ativos' && f.status !== 'ativo') return false
      if (statusTab === 'pendentes_mim' && (f.status !== 'ativo' || Boolean(f.myResponse)))
        return false
      if (statusTab === 'respondidos_mim' && !f.myResponse) return false
      if (statusTab === 'rascunhos' && f.status !== 'rascunho') return false
      if (statusTab === 'encerrados' && f.status !== 'encerrado') return false
      if (categoryFilter !== 'todas' && f.category !== categoryFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = f.title.toLowerCase().includes(q)
        const matchSub = (f.subtitle || '').toLowerCase().includes(q)
        const matchCat = (f.category || '').toLowerCase().includes(q)
        return matchTitle || matchSub || matchCat
      }
      return true
    })
  }, [forms, statusTab, categoryFilter, searchQuery])

  // ===========================================================================
  // VIEW 1: STUDIO MODE (BUILDER + DESIGN + SETTINGS + ANALYTICS)
  // ===========================================================================
  if (viewMode === 'studio' && selectedForm) {
    return (
      <div
        style={{
          padding: '28px 32px 60px',
          maxWidth: 1480,
          margin: '0 auto',
          minHeight: '100%',
          background: '#f8fafc',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <FormBuilderStudio
          initialForm={selectedForm}
          responses={selectedFormResponses}
          colaboradoresList={colaboradoresList}
          currentUser={currentUser}
          initialStudioTab={initialStudioTab}
          onSaveForm={handleSaveFormInStudio}
          onBack={() => {
            setViewMode('list')
            loadInitialData()
          }}
          onOpenManualEntry={(prefill, editResp) => {
            openFormToRespond(selectedForm, true, prefill, editResp || null)
          }}
          onDeleteResponse={handleDeleteResponse}
          onResponsesChange={nextResponses => {
            setSelectedFormResponses(nextResponses)
            setForms(prev =>
              prev.map(f =>
                f.id === selectedForm.id
                  ? { ...f, respostasCount: nextResponses.length }
                  : f
              )
            )
          }}
        />
      </div>
    )
  }

  // ===========================================================================
  // VIEW 2: RESPOND / MANUAL ENTRY MODE
  // ===========================================================================
  if (viewMode === 'respond' && selectedForm) {
    const prefilledEditingResponse: GPFormResponse | null = prefillColab
      ? {
          id: '',
          formId: selectedForm.id,
          protocol: '',
          respondentId: prefillColab.id,
          respondentName: prefillColab.nome,
          respondentEmail: prefillColab.email || '',
          respondentRole: prefillColab.cargo || 'Colaborador',
          respondentDepartment: prefillColab.departamento || '',
          respondentUnit: prefillColab.unidade || '',
          source: 'inserido_pelo_gestor',
          answers: {},
          submittedAt: new Date().toISOString(),
        }
      : editingResponse

    return (
      <div
        style={{
          minHeight: '100%',
          background: selectedForm.theme?.backgroundColor || '#f8fafc',
          padding: '28px 20px 64px',
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: '0 auto 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setViewMode('list')
              loadInitialData()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} /> Voltar para Formulários
          </button>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => openFormInStudio(selectedForm, 'perguntas')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={15} /> Editar Formulário
              </button>
              <button
                type="button"
                onClick={() => openFormInStudio(selectedForm, 'respostas')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <BarChart3 size={15} /> Ver Relatório de Respostas
              </button>
            </div>
          )}
        </div>

        <FormRenderer
          form={selectedForm}
          currentUser={currentUser}
          isAdmin={isAdmin}
          initialManualMode={respondManualMode}
          editingResponse={prefilledEditingResponse}
          colaboradoresList={colaboradoresList}
          onSubmitSuccess={() => {
            loadInitialData(true)
          }}
          onCancel={() => {
            setViewMode('list')
            loadInitialData(true)
          }}
        />
      </div>
    )
  }

  // ===========================================================================
  // VIEW 3: MAIN HUB / GALLERY OF FORMS
  // ===========================================================================
  return (
    <div
      style={{
        padding: '36px 40px 64px',
        maxWidth: 1560,
        margin: '0 auto',
        minHeight: '100%',
        background: '#f8fafc',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 20,
          marginBottom: 32,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 99,
              background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
              color: '#4f46e5',
              fontSize: 12.5,
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            <Sparkles size={15} /> Impacto Forms Studio • Gestão de Pessoas
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 900,
              color: '#0f172a',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
            }}
          >
            Formulários Dinâmicos & Avaliações
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 15.5,
              color: '#64748b',
              maxWidth: 700,
              lineHeight: 1.55,
            }}
          >
            {isAdmin
              ? 'Crie formulários personalizados com múltiplos layouts, lógica condicional, assinatura digital, lançamento manual de respostas e relatórios analíticos completos.'
              : 'Acesse e responda aos formulários, pesquisas e requerimentos oficiais da Gestão de Pessoas autenticados com seu perfil de colaborador.'}
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 24px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.28)',
              }}
            >
              <Plus size={20} /> Criar Novo Formulário
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 18,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: 22,
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileSpreadsheet size={26} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>{stats.ativos}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
              Formulários Ativos
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: 22,
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 size={26} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>
              {stats.totalRespostas}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
              Respostas Registradas
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: 22,
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: '#fffbeb',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={26} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>
              {stats.pendentesParaMim}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
              Pendentes para Você
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: 22,
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: '#f0f9ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={26} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>
              {stats.respondidosPorMim}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
              Respondidos por Você
            </div>
          </div>
        </div>
      </div>

      {/* Quick Template Strip (Like Google Forms Top Gallery!) */}
      {isAdmin && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 22,
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#334155' }}>
              Iniciar um novo formulário rapidamente (Galeria de Modelos RH):
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 12,
            }}
          >
            {FORM_TEMPLATE_BLUEPRINTS.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                disabled={creatingForm}
                onClick={() => handleCreateFromBlueprint(tpl)}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  textAlign: 'left',
                  cursor: creatingForm ? 'wait' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = tpl.color
                  e.currentTarget.style.background = '#ffffff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.background = '#f8fafc'
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    color: tpl.color,
                  }}
                >
                  <Plus size={14} /> {tpl.category}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{tpl.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {tpl.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'ativos', label: 'Ativos' },
            { id: 'pendentes_mim', label: `Pendentes para Mim (${stats.pendentesParaMim})` },
            { id: 'respondidos_mim', label: `Já Respondidos (${stats.respondidosPorMim})` },
            ...(isAdmin
              ? [
                  { id: 'rascunhos', label: 'Rascunhos' },
                  { id: 'encerrados', label: 'Encerrados' },
                ]
              : []),
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id as any)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: statusTab === tab.id ? '#0f172a' : '#f1f5f9',
                color: statusTab === tab.id ? '#ffffff' : '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', minWidth: 240 }}>
            <Search
              size={16}
              color="#94a3b8"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Buscar formulário..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 13.5,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <select
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
            }}
          >
            <option value="todas">Todas as Categorias</option>
            {FORM_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Forms Cards Grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
          Carregando formulários da Gestão de Pessoas...
        </div>
      ) : filteredForms.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: 60,
            textAlign: 'center',
            border: '1px dashed #cbd5e1',
          }}
        >
          <FileSpreadsheet size={48} color="#94a3b8" style={{ marginBottom: 14 }} />
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
            Nenhum formulário encontrado
          </h3>
          <p style={{ margin: '8px auto 20px', maxWidth: 440, fontSize: 14, color: '#64748b' }}>
            Não há formulários correspondentes aos filtros atuais.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              style={{
                padding: '12px 22px',
                borderRadius: 12,
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              + Criar Primeiro Formulário
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: 22,
          }}
        >
          {filteredForms.map(f => {
            const totalFields = f.sections.reduce(
              (acc, s) => acc + s.fields.filter(fl => fl.type !== 'bloco_informativo').length,
              0
            )
            const hasResponded = Boolean(f.myResponse)

            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: '#ffffff',
                  borderRadius: 22,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
                }}
              >
                {/* Card Top Banner */}
                <div
                  style={{
                    background: f.theme?.headerGradient || f.theme?.primaryColor || '#4f46e5',
                    padding: '20px 22px',
                    color: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 99,
                        background: 'rgba(255,255,255,0.2)',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {f.category}
                    </span>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {f.settings?.publicLink && (
                        <span
                          title="Qualquer pessoa com o link pode responder sem login"
                          style={{
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'rgba(34, 197, 94, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            color: '#ffffff',
                            fontSize: 10.5,
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Globe size={11} /> Link Público
                        </span>
                      )}
                      {f.settings?.allowAccessWithoutModule && (
                        <span
                          title="Liberado para qualquer usuário sem precisar de acesso ao módulo Gestão de Pessoas"
                          style={{
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'rgba(16, 185, 129, 0.35)',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            color: '#ffffff',
                            fontSize: 10.5,
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Globe size={11} /> Acesso Amplo
                        </span>
                      )}
                      {hasResponded ? (
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 99,
                            background: '#10b981',
                            color: '#ffffff',
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          ✓ Respondido
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 99,
                            background: 'rgba(255,255,255,0.22)',
                            color: '#ffffff',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {f.status === 'ativo'
                            ? '🟢 Ativo'
                            : f.status === 'rascunho'
                            ? '🟡 Rascunho'
                            : '⚪ Encerrado'}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3
                    style={{
                      margin: 0,
                      fontSize: 19,
                      fontWeight: 800,
                      lineHeight: 1.3,
                    }}
                  >
                    {f.title}
                  </h3>
                  {f.subtitle && (
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontSize: 13,
                        opacity: 0.9,
                        lineHeight: 1.4,
                      }}
                    >
                      {f.subtitle}
                    </p>
                  )}
                </div>

                {/* Card Body */}
                <div
                  style={{
                    padding: 22,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 18,
                  }}
                >
                  <div>
                    {f.description && (
                      <p
                        style={{
                          margin: '0 0 14px 0',
                          fontSize: 13.5,
                          color: '#64748b',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {stripHtmlToPlainText(f.description)}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#475569',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <ListChecks size={15} color="#6366f1" /> {totalFields} questões
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Layers size={15} color="#0ea5e9" /> {f.sections.length} seção(ões)
                      </span>
                      {isAdmin && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#059669' }}>
                          <BarChart3 size={15} /> {f.respostasCount || 0} respostas
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openFormToRespond(f, false)}
                        style={{
                          flex: 1,
                          padding: '11px 16px',
                          borderRadius: 12,
                          border: 'none',
                          background: f.theme?.primaryColor || '#4f46e5',
                          color: '#ffffff',
                          fontSize: 13.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {hasResponded
                          ? f.settings?.allowEditOwnResponse
                            ? 'Ver / Editar Minha Resposta'
                            : 'Responder Novamente'
                          : 'Responder Formulário'}
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openFormToRespond(f, true)}
                          title="Adicionar resposta manualmente em nome de um colaborador"
                          style={{
                            padding: '11px 14px',
                            borderRadius: 12,
                            border: '1.5px solid #10b981',
                            background: '#ecfdf5',
                            color: '#059669',
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <UserPlus size={16} /> + Lançar
                        </button>
                      )}
                    </div>

                    {isAdmin && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: 10,
                          borderTop: '1px solid #f1f5f9',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => openFormInStudio(f, 'perguntas')}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 9,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#1e293b',
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <Edit3 size={13} /> Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => openFormInStudio(f, 'respostas')}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 9,
                              border: '1px solid #c7d2fe',
                              background: '#eef2ff',
                              color: '#4f46e5',
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <BarChart3 size={13} /> Relatório ({f.respostasCount || 0})
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAllowWithoutModule(f)}
                            title={
                              f.settings?.allowAccessWithoutModule
                                ? 'Acesso liberado para qualquer usuário (sem estar com acesso ao módulo). Clique para restringir.'
                                : 'Acesso restrito ao módulo GP. Clique para liberar para qualquer usuário (sem estar com acesso ao módulo).'
                            }
                            style={{
                              padding: 7,
                              borderRadius: 8,
                              border: f.settings?.allowAccessWithoutModule
                                ? '1px solid #a7f3d0'
                                : '1px solid #cbd5e1',
                              background: f.settings?.allowAccessWithoutModule
                                ? '#ecfdf5'
                                : '#ffffff',
                              color: f.settings?.allowAccessWithoutModule
                                ? '#059669'
                                : '#64748b',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Globe size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => copyShareLink(f.id)}
                            title="Copiar link de compartilhamento para colaboradores"
                            style={{
                              padding: 7,
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              background: copiedId === f.id ? '#ecfdf5' : '#f8fafc',
                              color: copiedId === f.id ? '#10b981' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            {copiedId === f.id ? <Check size={15} /> : <Link2 size={15} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicateForm(f)}
                            title="Duplicar este formulário"
                            style={{
                              padding: 7,
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              background: '#f8fafc',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            <Copy size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteForm(f.id)}
                            title="Excluir formulário"
                            style={{
                              padding: 7,
                              borderRadius: 8,
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* MODAL DE GALERIA DE TEMPLATES */}
      {isTemplateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 26,
              maxWidth: 780,
              width: '100%',
              padding: 32,
              maxHeight: '88vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  Criar Novo Formulário em Gestão de Pessoas
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
                  Escolha um modelo pronto otimizado para RH ou comece com um formulário em branco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: 14,
              }}
            >
              {FORM_TEMPLATE_BLUEPRINTS.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={creatingForm}
                  onClick={() => handleCreateFromBlueprint(tpl)}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    textAlign: 'left',
                    cursor: creatingForm ? 'wait' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 99,
                      background: `${tpl.color}18`,
                      color: tpl.color,
                      fontSize: 11,
                      fontWeight: 800,
                      alignSelf: 'flex-start',
                    }}
                  >
                    {tpl.category}
                  </span>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0f172a' }}>
                    {tpl.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>
                    {tpl.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
