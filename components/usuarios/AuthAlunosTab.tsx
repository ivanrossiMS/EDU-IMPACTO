'use client'

import React, { useState } from 'react'
import { Search, Shield, Key, Pencil, Eye, Smartphone, Power, Copy, Check, Users } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { getInitials } from '@/lib/utils'

export function AuthAlunosTab() {
  const { alunos, setAlunos, logSystemAction } = useData()
  const [authUsers, setAuthUsers] = useLocalStorage<any[]>('edu-auth-users', [])
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState<any | null>(null)
  const [resetModal, setResetModal] = useState<any | null>(null)
  const [linksModal, setLinksModal] = useState<any | null>(null)
  
  // States for resetting password
  const [resetParams, setResetParams] = useState({ mode: 'auto', password: '', confirm: '', sendSms: false, sendEmail: false, requireChange: true })
  const [copied, setCopied] = useState(false)

  const handleCreateAuth = (academicStudent: any) => {
    // Merge if missing
    const exists = authUsers.find(u => u.academic_id === academicStudent.id && u.user_type === 'student')
    if (exists) return exists
    
    const newAuth = {
      id: crypto.randomUUID(),
      user_type: 'student',
      academic_id: academicStudent.id,
      login: (academicStudent as any).codigo || (academicStudent as any).matricula || academicStudent.id.substring(0, 8),
      email: (academicStudent as any).email || '',
      celular: (academicStudent as any).celular || (academicStudent as any).telefone || '',
      status: 'ATIVO',
      profile_code: 'FAMILIA',
      last_login: null
    }
    setAuthUsers(prev => [...prev, newAuth])
    return newAuth
  }

  const getGuardianList = (aluno: any) => {
    const list: any[] = []
    if (aluno._responsaveis && Array.isArray(aluno._responsaveis)) {
      list.push(...aluno._responsaveis)
    } else if (aluno.responsaveis && Array.isArray(aluno.responsaveis)) {
      aluno.responsaveis.forEach((r: any) => list.push({
        nome: r.nome,
        cpf: r.cpf,
        email: r.email,
        celular: r.telefone,
        tipo: r.respFinanceiro ? 'Financeiro' : r.respPedagogico ? 'Pedagógico' : 'Outro'
      }))
    } else if (aluno.responsavel) {
      list.push({
        nome: aluno.responsavel,
        cpf: aluno.cpf_responsavel || aluno.cpfResponsavel || '',
        email: aluno.email_responsavel || aluno.emailResponsavel || '',
        celular: aluno.celular_responsavel || aluno.telResponsavel || '',
        tipo: 'Responsável principal'
      })
    }
    return list
  }

  // Derived list: academic students merged with auth state
  const displayed = (alunos || []).map(aluno => {
    const authRecord = authUsers.find(u => u.academic_id === aluno.id && u.user_type === 'student')
    
    // Virtual record automatically linking the user to FAMILIA and ATIVO
    const defaultAuth = {
      id: `virtual-${aluno.id}`,
      user_type: 'student',
      academic_id: aluno.id,
      login: (aluno as any).codigo || (aluno as any).matricula || aluno.id.substring(0, 8),
      email: (aluno as any).email || '',
      celular: (aluno as any).celular || (aluno as any).telefone || '',
      status: 'ATIVO',
      profile_code: 'FAMILIA',
      last_login: null
    }

    return { ...aluno, auth: authRecord || defaultAuth }
  }).filter(item => {
    const q = search.toLowerCase()
    return item.nome.toLowerCase().includes(q) || ((item as any).turma && (item as any).turma.toLowerCase().includes(q)) || (item.auth?.login?.toLowerCase().includes(q))
  })

  const saveEdit = () => {
    if (!editModal) return
    const { auth, form, aluno } = editModal
    if (auth) {
      setAuthUsers(prev => prev.map(u => u.id === auth.id ? { ...u, email: form.email, celular: form.celular, login: (aluno as any).codigo || (aluno as any).matricula || u.login } : u))
    } else {
      // Create first
      const newU = handleCreateAuth(aluno)
      setAuthUsers(prev => prev.map(u => u.id === newU.id ? { ...u, email: form.email, celular: form.celular, login: (aluno as any).codigo || (aluno as any).matricula || u.login } : u))
    }

    // Bidirectional Sync: Salva na ficha acadêmica do aluno (Fonte de Verdade)
    setAlunos(prev => prev.map(a => a.id === aluno.id ? {
      ...a,
      email: form.email,
      celular: form.celular,
      telefone: form.celular
    } : a))

    logSystemAction('Config (Acessos)', 'Edição', `Atualização de contatos de acesso (Aluno: ${aluno.nome})`, { registroId: aluno.id, detalhesDepois: form })
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

  const handleResetPassword = () => {
    if (!resetModal) return
    let existingAuth = resetModal.auth
    if (!existingAuth || existingAuth.id?.startsWith('virtual-')) {
       existingAuth = handleCreateAuth(resetModal.aluno)
    }

    setAuthUsers(prev => prev.map(u => {
      if (u.id === existingAuth.id) {
        return { ...u, status: 'ATIVO', last_password_reset: new Date().toISOString() }
      }
      return u
    }))

    const allPass = JSON.parse(localStorage.getItem('edu-user-passwords') || '{}')
    delete allPass[existingAuth.id]
    localStorage.setItem('edu-user-passwords', JSON.stringify(allPass))

    logSystemAction('Config (Acessos)', 'Edição', `Redefinição de acesso (Aluno: ${resetModal.aluno.nome})`, { registroId: existingAuth.id })
    setResetModal(null)
  }

  const toggleStatus = (student: any) => {
    const auth = student.auth || handleCreateAuth(student)
    const newStatus = auth.status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
    setAuthUsers(prev => prev.map(u => u.id === auth.id ? { ...u, status: newStatus } : u))
    logSystemAction('Config (Acessos)', 'Edição', `Alteração de status de acesso (Aluno: ${student.nome}) -> ${newStatus}`, { registroId: auth.id, detalhesDepois: { status: newStatus } })
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
        <div style={{ position: 'relative', width: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" placeholder="Buscar por aluno, turma ou login..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Login / Código</th>
              <th>Turma</th>
              <th>E-mail</th>
              <th>Último Acesso</th>
              <th>Status Acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>Nenhum aluno encontrado ou não registrado.</td></tr>
            ) : (
              displayed.map(a => {
                const isConfigured = true // now always true logically, but we show the derived login
                const currentStatus = a.auth?.status || 'ATIVO'
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: 11, borderRadius: 8 }}>
                          {getInitials(a.nome)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{a.nome}</div>
                          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Shield size={9} /> Alunos</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4 }}>
                        {isConfigured ? a.auth.login : ((a as any).codigo || (a as any).matricula || '-')}
                      </code>
                    </td>
                    <td><span className="badge badge-neutral">{(a as any).turma || '-'}</span></td>
                    <td style={{ fontSize: 12 }}>{(a as any).email || a.auth?.email || '-'}</td>
                    <td style={{ fontSize: 12, color: a.auth?.last_login ? 'inherit' : 'hsl(var(--text-muted))' }}>{a.auth?.last_login || 'Nunca acessou'}</td>
                    <td>{badgeStatus(currentStatus)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Editar Contatos de Acesso" onClick={() => setEditModal({ aluno: a, auth: a.auth, form: { email: (a as any).email || a.auth?.email || '', celular: (a as any).celular || (a as any).telefone || a.auth?.celular || '' } })}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Responsáveis Vinculados" onClick={() => setLinksModal(a)}><Users size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Redefinir Senha" onClick={() => { setResetModal({ aluno: a, auth: a.auth }); setResetParams({ mode: 'auto', password: generateAutoPass(), confirm: '', sendSms: false, sendEmail: false, requireChange: true }); setCopied(false) }}><Key size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title={currentStatus === 'ATIVO' ? 'Inativar Acesso' : 'Ativar Acesso'} onClick={() => toggleStatus(a)}><Power size={13} style={{ color: currentStatus === 'ATIVO' ? '#ef4444' : '#10b981' }} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))' }}>
              <div style={{ fontWeight: 700 }}>Contatos de Acesso do Aluno</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{editModal.aluno.nome}</div>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.05)', borderRadius: 8, border: '1px dashed rgba(99,102,241,0.2)', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                <Shield size={14} style={{ display: 'inline', marginBottom: -2, marginRight: 4, color: '#6366f1' }}/>
                O Código do Aluno é a única chave de Acesso. O E-mail e Celular servem como segurança para recuperação de senha.
              </div>
              <div>
                <label className="form-label">Código do Aluno (Login)</label>
                <input className="form-input" disabled value={(editModal.aluno as any).codigo || (editModal.aluno as any).matricula || editModal.aluno.id.substring(0,8)} style={{ background: 'hsl(var(--bg-overlay))', cursor: 'not-allowed', color: 'hsl(var(--text-muted))' }} />
              </div>
              <div>
                <label className="form-label">E-mail para recuperação de senha</label>
                <input className="form-input" type="email" value={editModal.form.email} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, email: e.target.value } })} />
              </div>
              <div>
                <label className="form-label">Celular (com DDD)</label>
                <input className="form-input" value={editModal.form.celular} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, celular: e.target.value } })} placeholder="Ex: 11999999999" />
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit}>Salvar Contatos</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))' }}>
              <div style={{ fontWeight: 700 }}>Reiniciar Acesso do Aluno</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{resetModal.aluno.nome}</div>
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
               <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <Key size={24} />
               </div>
               <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Apagar senha atual?</h3>
               <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                 Ao confirmar, a senha deste aluno será removida do sistema imediatamente. <br/><br/>Ele precisará clicar em <strong>"Primeiro Acesso"</strong> na tela de login informando seu Código de Aluno para criar uma senha nova.
               </p>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setResetModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }} onClick={handleResetPassword}>Reiniciar Acesso</button>
            </div>
          </div>
        </div>
      )}

      {/* Links (Guardians) Modal */}
      {linksModal && (() => {
        const guardiansList = getGuardianList(linksModal)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Responsáveis Vinculados</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{linksModal.nome}</div>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setLinksModal(null)}>×</button>
              </div>
              <div style={{ padding: 20, display: 'grid', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
                {guardiansList.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>Nenhum responsável cadastrado para este aluno.</div>
                ) : (
                  guardiansList.map((g: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8 }}>
                      <div className="avatar" style={{ width: 28, height: 28, background: '#10b98120', color: '#10b981', fontSize: 10, borderRadius: 6 }}>{getInitials(g.nome || '?')}</div>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontSize: 13, fontWeight: 700 }}>{g.nome || '(Sem nome)'}</div>
                         <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ padding: '2px 6px', background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))', borderRadius: 4, fontWeight: 600 }}>{g.tipo || 'Responsável'}</span>
                         </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
