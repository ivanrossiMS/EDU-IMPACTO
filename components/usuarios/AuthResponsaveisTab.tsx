'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import React, { useState, useMemo, useEffect } from 'react'
import { Search, Shield, Key, Pencil, Eye, Power, Copy, Check, Users, RotateCcw, Mail } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { getInitials } from '@/lib/utils'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import { FirstAccessGeneratorModal, FirstAccessTargetUser } from '@/components/usuarios/FirstAccessGeneratorModal'
import { FirstAccessInviteCampaignModal, type PreselectedInviteUser } from '@/components/usuarios/FirstAccessInviteCampaignModal'

const TableSkeleton = () => (
  <div className="table-container" style={{ animation: 'fadeIn 0.25s ease-out' }}>
    <table>
      <thead>
        <tr>
          <th style={{ width: '25%' }}><div className="skeleton-shimmer" style={{ height: 16, borderRadius: 6, width: 80 }} /></th>
          <th style={{ width: '15%' }}><div className="skeleton-shimmer" style={{ height: 16, borderRadius: 6, width: 90 }} /></th>
          <th style={{ width: '15%' }}><div className="skeleton-shimmer" style={{ height: 16, borderRadius: 6, width: 70 }} /></th>
          <th style={{ width: '15%' }}><div className="skeleton-shimmer" style={{ height: 16, borderRadius: 6, width: 100 }} /></th>
          <th style={{ width: '10%' }}><div className="skeleton-shimmer" style={{ height: 16, borderRadius: 6, width: 80 }} /></th>
          <th style={{ width: '10%' }}><div className="skeleton-shimmer" style={{ height: 16, borderRadius: 6, width: 50 }} /></th>
          <th style={{ width: '10%' }}><div className="skeleton-shimmer" style={{ height: 16, borderRadius: 6, width: 60 }} /></th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 5 }).map((_, i) => (
          <tr key={i}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  <div className="skeleton-shimmer" style={{ height: 14, borderRadius: 6, width: '70%' }} />
                  <div className="skeleton-shimmer" style={{ height: 11, borderRadius: 6, width: '50%' }} />
                </div>
              </div>
            </td>
            <td><div className="skeleton-shimmer" style={{ height: 14, borderRadius: 6, width: '60%' }} /></td>
            <td><div className="skeleton-shimmer" style={{ height: 14, borderRadius: 6, width: '80%' }} /></td>
            <td><div className="skeleton-shimmer" style={{ height: 14, borderRadius: 6, width: '90%' }} /></td>
            <td><div className="skeleton-shimmer" style={{ height: 14, borderRadius: 6, width: '70%' }} /></td>
            <td><div className="skeleton-shimmer" style={{ height: 20, borderRadius: 12, width: 50 }} /></td>
            <td>
              <div style={{ display: 'flex', gap: 6 }}>
                <div className="skeleton-shimmer" style={{ width: 24, height: 24, borderRadius: 6 }} />
                <div className="skeleton-shimmer" style={{ width: 24, height: 24, borderRadius: 6 }} />
                <div className="skeleton-shimmer" style={{ width: 24, height: 24, borderRadius: 6 }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
export function AuthResponsaveisTab() {
  const { logSystemAction } = useData();
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'inativo' | 'todos_com_inativos'>('ativo');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: apiData, isLoading } = useApiQuery<any>(
    ['responsaveis_auth_tab', String(page), String(limit), debouncedSearch, statusFilter],
    '/api/responsaveis',
    { lightweight: true, page, limit, search: debouncedSearch, status: statusFilter }
  )
  const queryClient = useQueryClient()

  const [localResps, setLocalResps] = useState<any[]>([])

  useEffect(() => {
    if (apiData && Array.isArray(apiData.data)) {
      setLocalResps(apiData.data)
    }
  }, [apiData])

  const guardians = localResps
  const totalItems = apiData?.total || 0;

  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const [authUsers, setAuthUsers] = useLocalStorage<any[]>('edu-auth-users', [])
  const [editModal, setEditModal] = useState<any | null>(null)
  const [resetModal, setResetModal] = useState<any | null>(null)
  const [linksModal, setLinksModal] = useState<any | null>(null)
  const [firstAccessTarget, setFirstAccessTarget] = useState<FirstAccessTargetUser | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [preselectedInviteUser, setPreselectedInviteUser] = useState<PreselectedInviteUser | null>(null)
  
  // States for resetting password
  const [resetParams, setResetParams] = useState({ mode: 'auto', password: '', confirm: '', sendSms: false, sendEmail: false, requireChange: true })
  const [copied, setCopied] = useState(false)

  const getTurmaNome = (id: string) => {
    return (todasTurmas || []).find((t: any) => String(t.id) === String(id))?.nome || id
  }


  const handleCreateAuth = (guardian: any) => {
    const exists = authUsers.find(u => u.user_type === 'guardian' && u.reference_key === guardian.key)
    if (exists) return exists
    
    const newAuth = {
      id: crypto.randomUUID(),
      user_type: 'guardian',
      reference_key: guardian.key,
      login: guardian.email || guardian.celular || '',
      email: guardian.email || '',
      celular: guardian.celular || '',
      status: 'ATIVO',
      profile_code: 'FAMILIA',
      last_login: null
    }
    setAuthUsers(prev => [...prev, newAuth])
    return newAuth
  }

  const { data: usersData } = useApiQuery<any[]>(['usuarios'], '/api/configuracoes/usuarios')
  const { data: inviteHistoryResp } = useApiQuery<any>(
    ['first-access-invite-history'],
    '/api/comunicacao/primeiro-acesso-pendentes?historyOnly=true'
  )
  const inviteHistoryMap: Record<string, { sentAt: string; count: number }> =
    inviteHistoryResp?.history && typeof inviteHistoryResp.history === 'object'
      ? inviteHistoryResp.history
      : {}
  const [inviteFilter, setInviteFilter] = useState<'all' | 'invited_no_access' | 'not_invited_no_access' | 'accessed'>('all')

  const formatInviteSentDate = (iso?: string) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return ''
      return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    } catch {
      return ''
    }
  }

  // Merge with auth data and filter
  const displayed = guardians.map(g => {
    const refKey = g.email || g.cpf || g.nome
    const authRecord = authUsers.find(u => u.user_type === 'guardian' && (u.reference_key === refKey || (g.cpf && u.reference_key === g.cpf) || (g.email && u.reference_key === g.email)))
    const searchEmail = (g.email || (authRecord?.email) || '').trim().toLowerCase()
    const usersList: any[] = Array.isArray(usersData) ? usersData : (Array.isArray((usersData as any)?.data) ? (usersData as any).data : [])
    const realUser = usersList.find(
      u => u.id === `resp-${g.id}` || (searchEmail && u.email?.toLowerCase() === searchEmail && u.perfil === 'Família')
    )

    const rawRespEmail = (g.email || '').trim()
    const rawRespPhone = (g.celular || g.telefone || '').trim()
    const effectiveEmail = rawRespEmail || (authRecord?.email || '').trim()
    const effectivePhone = rawRespPhone || (authRecord?.celular || '').trim()

    const isGuardianInactive =
      g.status === 'inativo' ||
      g.acessoInativo === true ||
      g.dados?.acesso_inativo === true ||
      g.dados?.acesso_bloqueado === true ||
      String(g.dados?.auth_status || '').trim().toUpperCase() === 'INATIVO' ||
      (g.alunosAtivosCount !== undefined && g.alunosAtivosCount === 0 && (g.todosAlunosVinculados?.length || g.alunosVinculados?.length || 0) > 0)

    const resolvedStatus = isGuardianInactive ? 'INATIVO' : 'ATIVO'

    const resolvedLastLogin =
      (g.ultimoAcesso && g.ultimoAcesso !== 'Nunca acessou' ? g.ultimoAcesso : null) ||
      (realUser?.ultimoAcesso && realUser.ultimoAcesso !== 'Nunca acessou' ? realUser.ultimoAcesso : null) ||
      null

    const defaultAuth = {
      id: `virtual-${refKey}`,
      user_type: 'guardian',
      reference_key: refKey,
      login: effectiveEmail || effectivePhone || '',
      email: effectiveEmail,
      celular: effectivePhone,
      status: resolvedStatus,
      profile_code: 'FAMILIA',
      last_login: resolvedLastLogin
    }

    const auth = authRecord ? {
      ...authRecord,
      login: effectiveEmail || effectivePhone || authRecord.login || '',
      email: effectiveEmail,
      celular: effectivePhone,
      status: isGuardianInactive ? 'INATIVO' : (g.dados?.auth_status || authRecord.status || 'ATIVO'),
      last_login: resolvedLastLogin || authRecord.last_login || null,
    } : defaultAuth

    // Map backward compatibility for UI
    g.key = refKey
    if(g.alunosVinculados) {
      g.alunos = g.alunosVinculados
      g.tipos = new Set()
      g.alunosVinculados.forEach((l: any) => {
        if(l.isFinanceiro) g.tipos.add('Financeiro')
        if(l.isPedagogico) g.tipos.add('Pedagógico')
      })
      if(g.tipos.size === 0) g.tipos.add('Outro')
    }

    const colabUser = searchEmail ? (usersData || []).find((u: any) => u.email && u.email.toLowerCase() === searchEmail && u.cargo !== 'Responsáveis' && u.cargo !== 'Alunos' && u.vinculoAtivo !== false && String(u.colabStatus || u.status || 'ativo').trim().toLowerCase() !== 'inativo') : null
    const cleanEmailKey = (effectiveEmail || '').trim().toLowerCase()
    const inviteSentInfo = cleanEmailKey ? inviteHistoryMap[cleanEmailKey] || null : null

    return { ...g, email: effectiveEmail, celular: effectivePhone, telefone: effectivePhone, auth, colabUser, inviteSentInfo }
  }).filter(g => {
    const hasAccessed = Boolean(g.auth?.last_login && g.auth.last_login !== 'Nunca acessou')
    if (inviteFilter === 'accessed') return hasAccessed
    if (inviteFilter === 'invited_no_access') return !hasAccessed && Boolean(g.inviteSentInfo?.sentAt)
    if (inviteFilter === 'not_invited_no_access') return !hasAccessed && !g.inviteSentInfo?.sentAt
    return true
  })


  const saveEdit = async () => {
    if (!editModal) return
    const { auth, form, guardian } = editModal

    const newEmail = (form.email || '').trim()
    const newPhone = (form.celular || '').trim()

    // 1. Persistir no banco de dados principal (tabela 'responsaveis')
    const respId = guardian.id || guardian.responsavel_id
    if (respId && !String(respId).startsWith('virtual-')) {
      try {
        const res = await fetch(`/api/responsaveis?id=${respId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: respId,
            email: newEmail,
            telefone: newPhone,
          })
        })
        if (!res.ok) {
          console.error('Erro ao atualizar cadastro acadêmico do responsável:', await res.text())
        }
      } catch (err) {
        console.error('Erro de conexão ao atualizar cadastro acadêmico do responsável:', err)
      }
    }

    if (auth) {
      const newRefKey = newEmail || guardian.cpf || guardian.nome
      const newLogin = newEmail || newPhone || ''
      setAuthUsers(prev => prev.map(u => u.id === auth.id ? { ...u, email: newEmail, celular: newPhone, reference_key: newRefKey, login: newLogin } : u))
    } else {
      const newU = handleCreateAuth(guardian)
      const newRefKey = newEmail || guardian.cpf || guardian.nome
      const newLogin = newEmail || newPhone || ''
      setAuthUsers(prev => prev.map(u => u.id === newU.id ? { ...u, email: newEmail, celular: newPhone, reference_key: newRefKey, login: newLogin } : u))
    }

    setLocalResps(prev => prev.map(r => (r.id === respId || r.responsavel_id === respId) ? {
      ...r,
      email: newEmail,
      celular: newPhone,
      telefone: newPhone,
    } : r))

    logSystemAction('Config (Acessos)', 'Edição', `Atualização de contatos de acesso (Responsável: ${guardian.nome})`, { registroId: guardian.key, detalhesDepois: form })
    
    // Invalidate React Query Cache to force refresh from backend
    queryClient.invalidateQueries({ queryKey: ['responsaveis_auth_tab'] })
    queryClient.invalidateQueries({ queryKey: ['alunos_auth_tab'] })
    queryClient.invalidateQueries({ queryKey: ['responsaveis'] })
    queryClient.invalidateQueries({ queryKey: ['usuarios'] })

    setEditModal(null)
  }

  const generateAutoPass = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let pass = ''
    for (let i = 0; i < 7; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length))
    return pass
  }

  const copyToClip = (txt: string) => {
    navigator.clipboard.writeText(txt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleResetPassword = async () => {
    if (!resetModal) return
    const id = resetModal.guardian.id || resetModal.guardian.responsavel_id || resetModal.guardian.key;
    
    try {
      const res = await fetch('/api/auth/reset-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'responsavel', id: id })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Acesso reiniciado com sucesso!');
        logSystemAction('Config (Acessos)', 'Edição', `Redefinição de acesso (Responsável: ${resetModal.guardian.nome})`, { registroId: id })
      } else {
        alert(data.error || 'Erro ao reiniciar acesso.');
      }
    } catch (e) {
      alert('Erro ao comunicar com o servidor.');
    }

    setResetModal(null)
  }

  const toggleStatus = async (guardian: any) => {
    const auth = guardian.auth || handleCreateAuth(guardian)
    const currentStatus = auth.status === 'INATIVO' ? 'INATIVO' : 'ATIVO'
    const targetActive = currentStatus !== 'ATIVO'
    const newStatus = targetActive ? 'ATIVO' : 'INATIVO'
    const respId = guardian.id || guardian.responsavel_id

    try {
      const res = await fetch('/api/auth/toggle-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'responsavel', id: respId, active: targetActive }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Não foi possível alterar o status de acesso.')
        return
      }
      setAuthUsers(prev => prev.map(u => (u.id === auth.id || u.reference_key === guardian.key) ? { ...u, status: newStatus } : u))
      setLocalResps(prev => prev.map(r => (r.id === respId || r.responsavel_id === respId) ? {
        ...r,
        status: targetActive ? 'ativo' : 'inativo',
        acessoInativo: !targetActive,
        dados: { ...(r.dados || {}), acesso_inativo: !targetActive, auth_status: newStatus }
      } : r))
      queryClient.invalidateQueries({ queryKey: ['responsaveis_auth_tab'] })
      queryClient.invalidateQueries({ queryKey: ['responsaveis'] })
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      logSystemAction('Config (Acessos)', 'Edição', `Alteração de status de acesso (Responsável: ${guardian.nome}) -> ${newStatus}`, { registroId: respId || auth.id, detalhesDepois: { status: newStatus } })
    } catch {
      alert('Erro ao comunicar com o servidor para alterar o acesso.')
    }
  }

  const badgeStatus = (status: string) => {
    if (status === 'ATIVO') return <span className="badge badge-success">Ativo</span>
    if (status === 'INATIVO') return <span className="badge badge-danger">Inativo</span>
    if (status === 'SENHA_PROVISORIA') return <span className="badge badge-warning">Senha Prov.</span>
    return <span className="badge badge-neutral">S/ Acesso</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 320 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="form-input" placeholder="Buscar por responsável ou CPF..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40, background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 500 }} />
          </div>
          <select 
            value={limit} 
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: 13, fontWeight: 500 }}
          >
            <option value={20} style={{ color: '#0f172a', background: '#ffffff' }}>20 por pág.</option>
            <option value={50} style={{ color: '#0f172a', background: '#ffffff' }}>50 por pág.</option>
            <option value={100} style={{ color: '#0f172a', background: '#ffffff' }}>100 por pág.</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: 13, fontWeight: 700 }}
          >
            <option value="ativo">Status: Ativos (Com Alunos Ativos)</option>
            <option value="inativo">🚫 Inativos (Alunos Inativos / Bloqueados)</option>
            <option value="todos_com_inativos">📋 Todos (Com Inativos)</option>
          </select>
          <select
            value={inviteFilter}
            onChange={(e) => setInviteFilter(e.target.value as any)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: 13, fontWeight: 700 }}
          >
            <option value="all">Filtro Acesso/Convite: Todos</option>
            <option value="invited_no_access">📨 Sem Acesso • Convite Já Enviado</option>
            <option value="not_invited_no_access">⏳ Sem Acesso • Falta Enviar Convite</option>
            <option value="accessed">✅ Já Realizou 1º Acesso</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setPreselectedInviteUser(null)
              setInviteModalOpen(true)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(16, 185, 129, 0.35)',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(37, 99, 235, 0.08) 100%)',
              color: '#047857',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Mail size={14} />
            Disparar Convite 1º Acesso (Pais s/ Acesso)
          </button>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Total: <strong style={{ color: '#0f172a' }}>{totalItems}</strong>
          </div>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Responsável</th>
                <th>Login / Auth</th>
                <th>Alunos Vinculados</th>
                <th>E-mail</th>
                <th>Último Acesso</th>
                <th>Status Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>Nenhum responsável encontrado.</td></tr>
              ) : (
                displayed.map(g => {
                  const isConfigured = true // Ativo by default
                  const currentStatus = g.auth?.status || 'ATIVO'
                  return (
                    <tr key={g.key}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 32, height: 32, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, borderRadius: 8 }}>
                            {getInitials(g.nome)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{g.nome}</div>
                            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Shield size={9} /> Responsáveis</span>
                              {Array.from(g.tipos || [g.tipo || 'Outro']).map((t: any) => (
                                <span key={t} style={{ padding: '2px 6px', background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))', borderRadius: 4, fontWeight: 600 }}>{t}</span>
                              ))}
                              {g.colabUser && g.colabUser.vinculoAtivo !== false && String(g.colabUser.colabStatus || g.colabUser.status || 'ativo').trim().toLowerCase() !== 'inativo' && (
                                <span 
                                  style={{ 
                                    padding: '2px 7px', 
                                    background: 'rgba(59, 130, 246, 0.15)', 
                                    color: '#3b82f6', 
                                    border: '1px solid rgba(59, 130, 246, 0.3)', 
                                    borderRadius: 4, 
                                    fontWeight: 700, 
                                    fontSize: 10,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                  title={`Papel Duplo: Este responsável também é Colaborador (${g.colabUser.perfil || g.colabUser.cargo})`}
                                >
                                  👔 Colaborador: {g.colabUser.perfil || g.colabUser.cargo || 'Ativo'}
                                </span>
                              )}
                            </div>

                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4 }}>
                          {isConfigured ? g.auth.login : (g.email || g.celular || g.telefone || g.cpf || '-')}
                        </code>
                      </td>
                      <td>
                         <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#6366f1', cursor: 'pointer', fontWeight: 600 }} onClick={() => setLinksModal(g)}>
                            <Users size={12}/> {g.alunos.length} aluno(s)
                         </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{g.email || g.auth?.email || '-'}</td>
                      <td style={{ fontSize: 12, color: g.auth?.last_login ? 'inherit' : 'hsl(var(--text-muted))' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>{g.auth?.last_login || 'Nunca acessou'}</span>
                          {(!g.auth?.last_login || g.auth?.last_login === 'Nunca acessou') && (
                            g.inviteSentInfo?.sentAt ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: '#dcfce7',
                                  border: '1px solid #bbf7d0',
                                  color: '#15803d',
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  width: 'fit-content',
                                }}
                                title={`Convite de 1º acesso enviado ${g.inviteSentInfo.count || 1}x. Último envio em ${formatInviteSentDate(g.inviteSentInfo.sentAt)}`}
                              >
                                📨 Enviado em {formatInviteSentDate(g.inviteSentInfo.sentAt)}
                                {g.inviteSentInfo.count > 1 ? ` (${g.inviteSentInfo.count}x)` : ''}
                              </span>
                            ) : (g.email || g.auth?.email) ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: '#fffbeb',
                                  border: '1px solid #fde68a',
                                  color: '#b45309',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  width: 'fit-content',
                                }}
                              >
                                ⏳ Convite não enviado
                              </span>
                            ) : null
                          )}
                        </div>
                      </td>
                      <td>{badgeStatus(currentStatus)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(!g.auth?.last_login || g.auth?.last_login === 'Nunca acessou') && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title="Enviar E-mail Convite de 1º Acesso (Com links iOS/Android do App)"
                              style={{ color: '#059669' }}
                              onClick={() => {
                                setPreselectedInviteUser({
                                  nome: g.nome,
                                  email: g.email || g.auth?.email || '',
                                  categoria: 'responsavel',
                                  alunosVinculados: Array.isArray(g.alunos)
                                    ? g.alunos.map((a: any) => ({
                                        nome: a.nome || String(a),
                                        turma: a.turma ? getTurmaNome(a.turma) : undefined,
                                      }))
                                    : [],
                                })
                                setInviteModalOpen(true)
                              }}
                            >
                              <Mail size={13} />
                            </button>
                          )}
                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar Contatos de Acesso" onClick={() => setEditModal({ guardian: g, auth: g.auth, form: { email: g.email || g.auth?.email || '', celular: g.celular || g.telefone || g.auth?.celular || '' } })}><Pencil size={13} /></button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Criar 1º Acesso / Gerar Senha Aleatória"
                            style={{ color: '#3b82f6' }}
                            onClick={() =>
                              setFirstAccessTarget({
                                type: 'responsavel',
                                id: String(g.id || g.responsavel_id || g.key),
                                nome: g.nome,
                                email: g.email || g.auth?.email || '',
                                sublabel: g.cpf ? `CPF: ${g.cpf}` : 'Responsável',
                              })
                            }
                          >
                            <Key size={13} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Reiniciar 1º Acesso" onClick={() => { setResetModal({ guardian: g, auth: g.auth }); setResetParams({ mode: 'auto', password: generateAutoPass(), confirm: '', sendSms: false, sendEmail: false, requireChange: true }); setCopied(false) }}><RotateCcw size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" title={currentStatus === 'ATIVO' ? 'Inativar Acesso' : 'Ativar Acesso'} onClick={() => toggleStatus(g)}><Power size={13} style={{ color: currentStatus === 'ATIVO' ? '#ef4444' : '#10b981' }} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {totalItems > limit && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, totalItems)} de {totalItems}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: page === 1 ? '#f8fafc' : '#ffffff',
                    color: page === 1 ? '#94a3b8' : '#0f172a',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Anterior
                </button>
                <button 
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= totalItems}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: page * limit >= totalItems ? '#f8fafc' : '#ffffff',
                    color: page * limit >= totalItems ? '#94a3b8' : '#0f172a',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: page * limit >= totalItems ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
{/* Alunos Vinculados Modal */}
      {linksModal && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Alunos Vinculados</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{linksModal.nome}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setLinksModal(null)}>×</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 12 }}>
              {(linksModal.todosAlunosVinculados || linksModal.alunos || []).map((a: any) => {
                const isAluInativo = a.inativo || String(a.status || '').toLowerCase() === 'inativo'
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8 }}>
                    <div className="avatar" style={{ width: 28, height: 28, background: isAluInativo ? '#fee2e2' : '#6366f120', color: isAluInativo ? '#b91c1c' : '#6366f1', fontSize: 10, borderRadius: 6 }}>{getInitials(a.nome)}</div>
                    <div style={{ flex: 1 }}>
                       <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                         {a.nome}
                         {isAluInativo && (
                           <span style={{ padding: '1px 6px', fontSize: 10, fontWeight: 700, borderRadius: 6, background: '#fee2e2', color: '#b91c1c' }}>
                             Inativo
                           </span>
                         )}
                       </div>
                       <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Turma: {getTurmaNome(a.turma) || '-'}</div>
                    </div>
                    <div><code style={{ fontSize: 10, padding: '2px 6px', background: 'hsl(var(--bg-overlay))', borderRadius: 4 }}>{(a as any).codigo || (a as any).matricula || String(a.id).substring(0,8)}</code></div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>

      <AnimatePresence>
{/* Edit Modal (similar to Students) */}
      {editModal && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))' }}>
              <div style={{ fontWeight: 700 }}>Contatos de Acesso - Responsável</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{editModal.guardian.nome}</div>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
               <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.05)', borderRadius: 8, border: '1px dashed rgba(99,102,241,0.2)', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                <Shield size={14} style={{ display: 'inline', marginBottom: -2, marginRight: 4, color: '#6366f1' }}/>
                O e-mail ou celular deste painel define o login do pai/mãe para o Perfil FAMILIA.
              </div>
              <div>
                <label className="form-label">E-mail para login</label>
                <input className="form-input" type="email" value={editModal.form.email} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, email: e.target.value } })} />
              </div>
              <div>
                <label className="form-label">Celular para SMS/Login</label>
                <input className="form-input" value={editModal.form.celular} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, celular: e.target.value } })} />
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit}>Salvar Contatos</button>
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>

      <AnimatePresence>
{/* Reset Password Modal (similar to Students) */}
      {resetModal && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))' }}>
              <div style={{ fontWeight: 700 }}>Reiniciar Acesso do Responsável</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{resetModal.guardian.nome} ({resetModal.auth?.login || 'Sem login definido'})</div>
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
               <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <Key size={24} />
               </div>
               <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Apagar senha atual?</h3>
               <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                 Ao confirmar, a senha deste responsável será removida do sistema imediatamente. <br/><br/>Ele precisará clicar em <strong>"Primeiro Acesso"</strong> na tela de login informando seu e-mail para criar uma senha nova.
               </p>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setResetModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }} onClick={handleResetPassword}>Reiniciar Acesso</button>
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>

      <FirstAccessGeneratorModal
        isOpen={Boolean(firstAccessTarget)}
        onClose={() => setFirstAccessTarget(null)}
        initialUser={firstAccessTarget}
        defaultTabType="responsavel"
        onSuccess={({ user, login, action }) => {
          if (login) {
            setLocalResps(prev =>
              prev.map(r =>
                String(r.id || r.responsavel_id || r.key) === String(user.id)
                  ? { ...r, email: login }
                  : r
              )
            )
          }
          queryClient.invalidateQueries({ queryKey: ['responsaveis_auth_tab'] })
          queryClient.invalidateQueries({ queryKey: ['alunos_auth_tab'] })
          queryClient.invalidateQueries({ queryKey: ['responsaveis'] })
          queryClient.invalidateQueries({ queryKey: ['usuarios'] })
          logSystemAction(
            'Config (Acessos)',
            'Edição',
            action === 'created'
              ? `1º Acesso com senha aleatória gerado (Responsável: ${user.nome} — ${login})`
              : `Redefinição de acesso (Responsável: ${user.nome})`,
            { registroId: user.id }
          )
        }}
      />

      <FirstAccessInviteCampaignModal
        isOpen={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false)
          setPreselectedInviteUser(null)
        }}
        defaultCategory="responsavel"
        preselectedUser={preselectedInviteUser}
        onCampaignSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['first-access-invite-history'] })
        }}
      />
    </div>
  )
}
