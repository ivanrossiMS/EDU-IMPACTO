'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Mail,
  Shield,
  GraduationCap,
  Users,
  Search,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'

export type FirstAccessUserType = 'system_user' | 'aluno' | 'responsavel'

export interface FirstAccessTargetUser {
  type: FirstAccessUserType
  id: string
  nome: string
  email?: string
  sublabel?: string
}

export function generateRandomPass(length = 8): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits

  let pass = ''
  pass += upper.charAt(Math.floor(Math.random() * upper.length))
  pass += lower.charAt(Math.floor(Math.random() * lower.length))
  pass += digits.charAt(Math.floor(Math.random() * digits.length))

  for (let i = 3; i < length; i++) {
    pass += all.charAt(Math.floor(Math.random() * all.length))
  }

  return pass
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

interface FirstAccessGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  initialUser?: FirstAccessTargetUser | null
  defaultTabType?: FirstAccessUserType
  onSuccess?: (result: {
    user: FirstAccessTargetUser
    login: string
    password: string
    action: 'created' | 'reset'
  }) => void
}

export function FirstAccessGeneratorModal({
  isOpen,
  onClose,
  initialUser = null,
  defaultTabType = 'system_user',
  onSuccess,
}: FirstAccessGeneratorModalProps) {
  const [selectedUser, setSelectedUser] = useState<FirstAccessTargetUser | null>(initialUser)
  const [selectorType, setSelectorType] = useState<FirstAccessUserType>(defaultTabType)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FirstAccessTargetUser[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState('')

  const [copiedPass, setCopiedPass] = useState(false)
  const [copiedFull, setCopiedFull] = useState(false)

  const [createdResult, setCreatedResult] = useState<{
    nome: string
    login: string
    password: string
    emailSent: boolean
    emailError?: string
  } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedUser(initialUser || null)
      setSelectorType(initialUser?.type || defaultTabType)
      setEmail(initialUser?.email || '')
      setPassword(generateRandomPass(8))
      setSendEmail(true)
      setError('')
      setCreatedResult(null)
      setCopiedPass(false)
      setCopiedFull(false)
      setSearchQuery('')
    }
  }, [isOpen, initialUser, defaultTabType])

  // Update email and password when a user is chosen from the selector
  const handleSelectUser = (u: FirstAccessTargetUser) => {
    setSelectedUser(u)
    setEmail(u.email || '')
    setPassword(generateRandomPass(8))
    setError('')
    setCreatedResult(null)
  }

  // Search users when in selector mode
  useEffect(() => {
    if (!isOpen || selectedUser) return

    let active = true
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const q = searchQuery.trim()
        if (selectorType === 'system_user') {
          const res = await fetch(
            `/api/configuracoes/usuarios?type=colaboradores&page=1&limit=25&search=${encodeURIComponent(q)}`
          )
          const data = await res.json().catch(() => ({}))
          if (!active) return
          const rows = Array.isArray(data?.data) ? data.data : []
          setSearchResults(
            rows.map((r: any) => ({
              type: 'system_user',
              id: String(r.id),
              nome: r.nome || 'Sem nome',
              email: r.email || '',
              sublabel: `${r.cargo || 'Colaborador'} • Perfil: ${r.perfil || 'Colaborador'}`,
            }))
          )
        } else if (selectorType === 'aluno') {
          const res = await fetch(
            `/api/alunos?lightweight=true&page=1&limit=25&search=${encodeURIComponent(q)}`
          )
          const data = await res.json().catch(() => ({}))
          if (!active) return
          const rows = Array.isArray(data?.data) ? data.data : []
          setSearchResults(
            rows.map((a: any) => ({
              type: 'aluno',
              id: String(a.id),
              nome: a.nome || 'Sem nome',
              email: a.email || a.dados?.email || '',
              sublabel: `Matrícula/Cód: ${a.codigo || a.matricula || String(a.id).substring(0, 8)}`,
            }))
          )
        } else if (selectorType === 'responsavel') {
          const res = await fetch(
            `/api/responsaveis?lightweight=true&page=1&limit=25&search=${encodeURIComponent(q)}`
          )
          const data = await res.json().catch(() => ({}))
          if (!active) return
          const rows = Array.isArray(data?.data) ? data.data : []
          setSearchResults(
            rows.map((g: any) => ({
              type: 'responsavel',
              id: String(g.id || g.responsavel_id),
              nome: g.nome || 'Sem nome',
              email: g.email || '',
              sublabel: g.cpf ? `CPF: ${g.cpf}` : 'Responsável',
            }))
          )
        }
      } catch {
        if (active) setSearchResults([])
      } finally {
        if (active) setIsSearching(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isOpen, selectedUser, selectorType, searchQuery])

  if (!isOpen) return null

  const typeBadge = (type: FirstAccessUserType) => {
    if (type === 'system_user') {
      return { label: 'Colaborador', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: <Shield size={12} /> }
    }
    if (type === 'aluno') {
      return { label: 'Aluno', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <GraduationCap size={12} /> }
    }
    return { label: 'Responsável', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: <Users size={12} /> }
  }

  const copyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw)
    setCopiedPass(true)
    setTimeout(() => setCopiedPass(false), 2000)
  }

  const copyFullCredentials = (nome: string, login: string, pw: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://impacto-edu.net'
    const text = `Olá, ${nome}!\nSeu acesso à plataforma Impacto EDU foi gerado:\n\n📧 Login (E-mail): ${login}\n🔑 Senha: ${pw}\n\nAcesse em: ${origin}/login`
    navigator.clipboard.writeText(text)
    setCopiedFull(true)
    setTimeout(() => setCopiedFull(false), 2500)
  }

  const handleCreateFirstAccess = async () => {
    if (!selectedUser) return
    const cleanEmail = email.trim().toLowerCase()
    const cleanPass = password.trim()

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('Informe um endereço de e-mail válido para o login deste usuário.')
      return
    }
    if (cleanPass.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auth/create-first-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedUser.type,
          id: selectedUser.id,
          email: cleanEmail,
          password: cleanPass,
          sendEmail,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Não foi possível criar o primeiro acesso.')
        setIsSubmitting(false)
        return
      }

      setCreatedResult({
        nome: data.nome || selectedUser.nome,
        login: data.login || cleanEmail,
        password: data.password || cleanPass,
        emailSent: Boolean(data.emailSent),
        emailError: data.emailError,
      })

      if (onSuccess) {
        onSuccess({
          user: { ...selectedUser, email: cleanEmail },
          login: data.login || cleanEmail,
          password: data.password || cleanPass,
          action: 'created',
        })
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de conexão com o servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetWithoutPassword = async () => {
    if (!selectedUser) return
    if (
      !confirm(
        `Deseja remover a senha atual de ${selectedUser.nome}? Ele ficará sem senha e precisará usar a opção "Primeiro Acesso" (com código no e-mail) na tela de login.`
      )
    ) {
      return
    }

    setIsResetting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedUser.type, id: selectedUser.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao reiniciar acesso.')
        setIsResetting(false)
        return
      }
      if (onSuccess) {
        onSuccess({
          user: selectedUser,
          login: email.trim(),
          password: '',
          action: 'reset',
        })
      }
      alert(data.message || 'Acesso reiniciado com sucesso!')
      onClose()
    } catch {
      setError('Erro ao comunicar com o servidor.')
    } finally {
      setIsResetting(false)
    }
  }

  const badge = selectedUser ? typeBadge(selectedUser.type) : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: 16,
          backdropFilter: 'blur(4px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="card"
          style={{
            width: '100%',
            maxWidth: 500,
            padding: 0,
            overflow: 'hidden',
            borderRadius: 18,
            border: '1px solid hsl(var(--border-default))',
            background: 'hsl(var(--bg-surface))',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-overlay))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(59,130,246,0.12)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Key size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'hsl(var(--text-primary))' }}>
                  Criar 1º Acesso • Senha Aleatória
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  {selectedUser
                    ? `Gerar credenciais imediatas para ${selectedUser.nome}`
                    : 'Selecione o tipo de usuário e busque pelo nome ou e-mail'}
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 20 }}>
            {/* STEP 1: SELECT USER (if opened from header without pre-selected user) */}
            {!selectedUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Tabs for User Type */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                    padding: 4,
                    borderRadius: 10,
                    background: 'hsl(var(--bg-base))',
                    border: '1px solid hsl(var(--border-subtle))',
                  }}
                >
                  {(
                    [
                      { key: 'system_user', label: 'Colaboradores', icon: <Shield size={13} /> },
                      { key: 'aluno', label: 'Alunos', icon: <GraduationCap size={13} /> },
                      { key: 'responsavel', label: 'Responsáveis', icon: <Users size={13} /> },
                    ] as const
                  ).map(t => {
                    const active = selectorType === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setSelectorType(t.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 12.5,
                          fontWeight: active ? 700 : 500,
                          background: active ? '#3b82f6' : 'transparent',
                          color: active ? '#ffffff' : 'hsl(var(--text-secondary))',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t.icon}
                        {t.label}
                      </button>
                    )
                  })}
                </div>

                {/* Search Input */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder={
                      selectorType === 'system_user'
                        ? 'Buscar colaborador por nome, cargo ou e-mail...'
                        : selectorType === 'aluno'
                        ? 'Buscar aluno por nome, matrícula ou e-mail...'
                        : 'Buscar responsável por nome, CPF ou e-mail...'
                    }
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 36 }}
                    autoFocus
                  />
                </div>

                {/* Results List */}
                <div
                  style={{
                    maxHeight: 290,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 12,
                    padding: 8,
                    background: 'hsl(var(--bg-base))',
                  }}
                >
                  {isSearching ? (
                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                      Buscando usuários...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                      Nenhum usuário encontrado.
                    </div>
                  ) : (
                    searchResults.map(u => {
                      const b = typeBadge(u.type)
                      return (
                        <button
                          key={`${u.type}-${u.id}`}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 9,
                            border: '1px solid hsl(var(--border-subtle))',
                            background: 'hsl(var(--bg-surface))',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'hsl(var(--text-primary))',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {u.nome}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  background: b.bg,
                                  color: b.color,
                                }}
                              >
                                {b.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                              {u.email ? `📧 ${u.email}` : '⚠️ Sem e-mail cadastrado'}
                              {u.sublabel ? ` • ${u.sublabel}` : ''}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#3b82f6',
                              flexShrink: 0,
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: 'rgba(59,130,246,0.1)',
                            }}
                          >
                            Selecionar →
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : createdResult ? (
              /* STEP 3: SUCCESS VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>
                      Primeiro Acesso Criado com Sucesso!
                    </div>
                    <div style={{ fontSize: 12.5, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                      A senha aleatória já está ativa para <strong>{createdResult.nome}</strong>.
                      {createdResult.emailSent
                        ? ` As credenciais também foram enviadas para ${createdResult.login}.`
                        : createdResult.emailError
                        ? ` (Aviso: falha no disparo de e-mail: ${createdResult.emailError})`
                        : ''}
                    </div>
                  </div>
                </div>

                {/* Credentials Card */}
                <div
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    background: 'hsl(var(--bg-base))',
                    border: '2px dashed rgba(59,130,246,0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: 'hsl(var(--text-muted))',
                        letterSpacing: '0.06em',
                        marginBottom: 4,
                      }}
                    >
                      Login de Acesso (E-mail)
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'hsl(var(--text-primary))',
                        wordBreak: 'break-all',
                      }}
                    >
                      {createdResult.login}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: 'hsl(var(--text-muted))',
                        letterSpacing: '0.06em',
                        marginBottom: 6,
                      }}
                    >
                      Senha Aleatória Gerada
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <code
                        style={{
                          fontFamily: "'Courier New', Courier, monospace",
                          fontSize: 24,
                          fontWeight: 900,
                          letterSpacing: 3,
                          color: '#3b82f6',
                          background: 'rgba(59,130,246,0.08)',
                          padding: '6px 14px',
                          borderRadius: 8,
                        }}
                      >
                        {createdResult.password}
                      </code>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => copyPassword(createdResult.password)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                      >
                        {copiedPass ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        {copiedPass ? 'Senha Copiada!' : 'Copiar Senha'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Copy full message button */}
                <button
                  type="button"
                  onClick={() =>
                    copyFullCredentials(createdResult.nome, createdResult.login, createdResult.password)
                  }
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '11px 16px',
                    fontWeight: 700,
                  }}
                >
                  {copiedFull ? <Check size={15} /> : <Copy size={15} />}
                  {copiedFull
                    ? 'Credenciais Copiadas para a Área de Transferência!'
                    : 'Copiar Login + Senha (para WhatsApp / Mensagem)'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  {!initialUser && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setSelectedUser(null)
                        setCreatedResult(null)
                      }}
                    >
                      Gerar para outro usuário
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={onClose}>
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: CONFIGURE & GENERATE PASSWORD */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Selected User Summary Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'hsl(var(--bg-base))',
                    border: '1px solid hsl(var(--border-subtle))',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                        {selectedUser.nome}
                      </span>
                      {badge && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {selectedUser.sublabel && (
                      <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                        {selectedUser.sublabel}
                      </div>
                    )}
                  </div>
                  {!initialUser && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedUser(null)}
                      style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <ArrowLeft size={13} /> Trocar
                    </button>
                  )}
                </div>

                {error && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.28)',
                      color: '#ef4444',
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>E-mail de Login *</span>
                    {!selectedUser.email && (
                      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                        Cadastre o e-mail para liberar o login
                      </span>
                    )}
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="usuario@exemplo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                {/* Random Password Field */}
                <div>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Senha Aleatória de 1º Acesso *</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPassword(generateRandomPass(8))
                        setCopiedPass(false)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: 0,
                      }}
                    >
                      <RefreshCw size={12} /> Sortear outra senha
                    </button>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: 18,
                        fontWeight: 800,
                        letterSpacing: 2,
                        color: '#3b82f6',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => copyPassword(password)}
                      title="Copiar senha"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '0 14px',
                        border: '1px solid hsl(var(--border-default))',
                        flexShrink: 0,
                        fontWeight: 700,
                        fontSize: 12.5,
                      }}
                    >
                      {copiedPass ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      {copiedPass ? 'Copiada' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Checkbox to send email */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    color: 'hsl(var(--text-primary))',
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={e => setSendEmail(e.target.checked)}
                    style={{ width: 15, height: 15, cursor: 'pointer' }}
                  />
                  <Mail size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
                  <span>Enviar Login e Senha Aleatória por e-mail para o usuário</span>
                </label>

                {/* Primary & Secondary Actions */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    paddingTop: 8,
                    borderTop: '1px solid hsl(var(--border-subtle))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={onClose}
                      disabled={isSubmitting || isResetting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCreateFirstAccess}
                      disabled={isSubmitting || isResetting}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                    >
                      <Key size={14} />
                      {isSubmitting ? 'Criando Acesso...' : 'Criar 1º Acesso com Senha Aleatória'}
                    </button>
                  </div>

                  {/* Secondary option: Reset without password */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 8,
                      borderTop: '1px dashed hsl(var(--border-subtle))',
                      fontSize: 11.5,
                      color: 'hsl(var(--text-muted))',
                    }}
                  >
                    <span>Prefere que o próprio usuário crie a senha via código OTP?</span>
                    <button
                      type="button"
                      onClick={handleResetWithoutPassword}
                      disabled={isSubmitting || isResetting}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontWeight: 700,
                        fontSize: 11.5,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <RotateCcw size={12} />
                      {isResetting ? 'Reiniciando...' : 'Zerar senha atual'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
