'use client'

import React, { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3, Edit3, UserPlus } from 'lucide-react'
import { useApp } from '@/lib/context'
import { GPForm, GPFormResponse } from '@/lib/gestao-pessoas/formulariosTypes'
import { FormRenderer } from '@/components/gestao-pessoas/formularios/FormRenderer'
import { FormBuilderStudio } from '@/components/gestao-pessoas/formularios/FormBuilderStudio'

export default function FormularioDirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { currentUser } = useApp()

  const [form, setForm] = useState<GPForm | null>(null)
  const [responses, setResponses] = useState<GPFormResponse[]>([])
  const [colaboradoresList, setColaboradoresList] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasModuleAccess, setHasModuleAccess] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'respond' | 'manual' | 'studio' | 'report'>('respond')

  useEffect(() => {
    loadFormDetails()
  }, [id])

  const loadFormDetails = async () => {
    setLoading(true)
    try {
      const [res, funcsRes] = await Promise.all([
        fetch(`/api/gestao-pessoas/formularios/${id}`, { cache: 'no-store' }),
        fetch('/api/rh/funcionarios?lightweight=true', { cache: 'no-store' }).catch(
          () => null
        ),
      ])

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        setError(errJson.error || 'Formulário não encontrado ou indisponível.')
        setHasModuleAccess(Boolean(errJson.hasModuleAccess ?? false))
        setLoading(false)
        return
      }

      const data = await res.json()
      setForm(data.form)
      setIsAdmin(Boolean(data.isAdmin))
      setHasModuleAccess(Boolean(data.hasModuleAccess ?? true))
      setResponses(Array.isArray(data.responses) ? data.responses : [])

      if (funcsRes && funcsRes.ok) {
        const funcs = await funcsRes.json()
        if (Array.isArray(funcs)) {
          setColaboradoresList(
            funcs.filter((f: any) => String(f.status || 'ativo').toLowerCase() !== 'inativo')
          )
        }
      }
    } catch (err) {
      setError('Erro de conexão ao carregar o formulário.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
        Carregando formulário...
      </div>
    )
  }

  if (error || !form) {
    const isRestricted = error.toLowerCase().includes('módulo') || error.toLowerCase().includes('restrito') || error.toLowerCase().includes('acesso')
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>🚫</span>
        </div>
        <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#ef4444', textTransform: 'uppercase' }}>
          ERRO 403 · ACESSO RESTRITO
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          {isRestricted ? 'Acesso Negado ao Formulário' : 'Formulário Não Encontrado'}
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 440, margin: 0, lineHeight: 1.5 }}>
          {error || 'Formulário não encontrado ou indisponível.'}
        </p>
        <button
          type="button"
          onClick={() => router.push(hasModuleAccess ? '/gestao-pessoas/formularios' : '/dashboard')}
          style={{
            marginTop: 12,
            padding: '12px 26px',
            borderRadius: 12,
            border: 'none',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {hasModuleAccess ? '← Voltar para Formulários' : '← Voltar ao Início'}
        </button>
      </div>
    )
  }

  if ((mode === 'studio' || mode === 'report') && isAdmin) {
    return (
      <div style={{ padding: '28px 32px 60px', maxWidth: 1480, margin: '0 auto' }}>
        <FormBuilderStudio
          initialForm={form}
          responses={responses}
          colaboradoresList={colaboradoresList}
          currentUser={currentUser}
          initialStudioTab={mode === 'report' ? 'respostas' : 'perguntas'}
          onSaveForm={async updated => {
            const r = await fetch(`/api/gestao-pessoas/formularios/${form.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            })
            if (!r.ok) {
              const err = await r.json().catch(() => ({}))
              throw new Error(err.error || 'Erro ao salvar formulário.')
            }
            const saved = await r.json()
            setForm(saved)
          }}
          onBack={() => setMode('respond')}
          onOpenManualEntry={() => setMode('manual')}
          onDeleteResponse={async respId => {
            const r = await fetch(
              `/api/gestao-pessoas/formularios/${form.id}/respostas?responseId=${encodeURIComponent(
                respId
              )}`,
              { method: 'DELETE' }
            )
            if (r.ok) {
              setResponses(prev => prev.filter(x => x.id !== respId))
            }
          }}
          onResponsesChange={next => setResponses(next)}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: form.theme?.backgroundColor || '#f8fafc',
        padding: '28px 20px 64px',
      }}
    >
      {(hasModuleAccess || isAdmin) && (
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
          {hasModuleAccess && (
            <button
              type="button"
              onClick={() => router.push('/gestao-pessoas/formularios')}
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
              <ArrowLeft size={16} /> Central de Formulários
            </button>
          )}

          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: hasModuleAccess ? undefined : 'auto' }}>
              <button
                type="button"
                onClick={() => setMode(mode === 'manual' ? 'respond' : 'manual')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid #10b981',
                  background: '#ecfdf5',
                  color: '#059669',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <UserPlus size={15} /> + Adicionar Resposta Manual
              </button>
              <button
                type="button"
                onClick={() => setMode('studio')}
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
                onClick={() => setMode('report')}
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
                <BarChart3 size={15} /> Relatório ({responses.length})
              </button>
            </div>
          )}
        </div>
      )}

      <FormRenderer
        form={form}
        currentUser={currentUser}
        isAdmin={isAdmin}
        initialManualMode={mode === 'manual'}
        colaboradoresList={colaboradoresList}
        onSubmitSuccess={() => loadFormDetails()}
        onCancel={hasModuleAccess ? () => router.push('/gestao-pessoas/formularios') : undefined}
      />
    </div>
  )
}
