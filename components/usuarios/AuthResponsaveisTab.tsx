'use client'

import React, { useState, useMemo } from 'react'
import { Search, Shield, Key, Pencil, Eye, Power, Copy, Check, Users } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { getInitials } from '@/lib/utils'

export function AuthResponsaveisTab() {
  const { alunos, setAlunos, logSystemAction } = useData()
  const [authUsers, setAuthUsers] = useLocalStorage<any[]>('edu-auth-users', [])
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState<any | null>(null)
  const [resetModal, setResetModal] = useState<any | null>(null)
  const [linksModal, setLinksModal] = useState<any | null>(null)
  
  // States for resetting password
  const [resetParams, setResetParams] = useState({ mode: 'auto', password: '', confirm: '', sendSms: false, sendEmail: false, requireChange: true })
  const [copied, setCopied] = useState(false)

  // Extract unique guardians from students
  const guardians = useMemo(() => {
    const gMap = new Map<string, any>()
    
    alunos.forEach(aluno => {
      // Extractor helper
      const addGuardian = (g: any, types: string[]) => {
        if (!g.nome) return
        const key = g.email || g.cpf || g.nome // fallback to name
        if (!gMap.has(key)) {
          gMap.set(key, { ...g, key, alunos: [aluno], tipos: new Set(types.length ? types : ['Outro']) })
        } else {
          const ex = gMap.get(key)
          // avoid duplicating the same student for a guardian
          if (!ex.alunos.find((a: any) => a.id === aluno.id)) {
            ex.alunos.push(aluno)
          }
          types.forEach(t => ex.tipos.add(t))
        }
      }

      // Check _responsaveis (new format)
      if ((aluno as any)._responsaveis && Array.isArray((aluno as any)._responsaveis)) {
        (aluno as any)._responsaveis.forEach((r: any) => addGuardian(r, [r.tipo || 'Outro']))
      } 
      // Check responsaveis (legacy format)
      else if ((aluno as any).responsaveis && Array.isArray((aluno as any).responsaveis)) {
        (aluno as any).responsaveis.forEach((r: any) => {
          let tps = [];
          if (r.respFinanceiro) tps.push('Financeiro');
          if (r.respPedagogico) tps.push('Pedagógico');
          addGuardian({
            nome: r.nome,
            cpf: r.cpf,
            email: r.email,
            celular: r.telefone // mapping
          }, tps.length ? tps : ['Outro'])
        })
      } 
      // Fallback flat fields
      else if (aluno.responsavel) {
        addGuardian({
          nome: aluno.responsavel,
          cpf: (aluno as any).cpf_responsavel || (aluno as any).cpfResponsavel || '',
          email: (aluno as any).email_responsavel || (aluno as any).emailResponsavel || '',
          celular: (aluno as any).celular_responsavel || (aluno as any).telResponsavel || ''
        }, ['Responsável principal'])
      }
    })

    return Array.from(gMap.values())
  }, [alunos])

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

  // Merge with auth data and filter
  const displayed = guardians.map(g => {
    const authRecord = authUsers.find(u => u.user_type === 'guardian' && (u.reference_key === g.key || (g.cpf && u.reference_key === g.cpf) || (g.email && u.reference_key === g.email)))
    
    const defaultAuth = {
      id: `virtual-${g.key}`,
      user_type: 'guardian',
      reference_key: g.key,
      login: g.email || g.celular || '',
      email: g.email || '',
      celular: g.celular || '',
      status: 'ATIVO',
      profile_code: 'FAMILIA',
      last_login: null
    }

    return { ...g, auth: authRecord || defaultAuth }
  }).filter(item => {
    const q = search.toLowerCase()
    return item.nome.toLowerCase().includes(q) || (item.cpf && item.cpf.includes(q)) || (item.auth?.login?.toLowerCase().includes(q))
  })

  const saveEdit = () => {
    if (!editModal) return
    const { auth, form, guardian } = editModal
    if (auth) {
      const newRefKey = form.email || guardian.cpf || guardian.nome
      const newLogin = form.email || form.celular || ''
      setAuthUsers(prev => prev.map(u => u.id === auth.id ? { ...u, email: form.email, celular: form.celular, reference_key: newRefKey, login: newLogin } : u))
    } else {
      const newU = handleCreateAuth(guardian)
      const newRefKey = form.email || guardian.cpf || guardian.nome
      const newLogin = form.email || form.celular || ''
      setAuthUsers(prev => prev.map(u => u.id === newU.id ? { ...u, email: form.email, celular: form.celular, reference_key: newRefKey, login: newLogin } : u))
    }

    // Bidirectional Sync: Update ALL academic records where this guardian exists
    setAlunos(prev => prev.map(aluno => {
       let changed = false
       const a = { ...aluno } as any
       
       const updateG = (gx: any) => {
         if ((gx.cpf === guardian.cpf && guardian.cpf) || (gx.nome === guardian.nome)) {
            gx.email = form.email
            gx.celular = form.celular
            gx.telefone = form.celular // legacy mapping
            changed = true
         }
         return gx
       }

       if (a._responsaveis && Array.isArray(a._responsaveis)) {
         a._responsaveis = a._responsaveis.map((gx: any) => ({...gx}))
         a._responsaveis.forEach(updateG)
       } 
       if (a.responsaveis && Array.isArray(a.responsaveis)) {
         a.responsaveis = a.responsaveis.map((gx: any) => ({...gx}))
         a.responsaveis.forEach(updateG)
       }
       if (a.responsavel && guardian.nome === a.responsavel) {
         a.email_responsavel = form.email
         a.emailResponsavel = form.email
         a.celular_responsavel = form.celular
         a.telResponsavel = form.celular
         changed = true
       }

       return changed ? a : aluno
    }))

    logSystemAction('Config (Acessos)', 'Edição', `Atualização de contatos de acesso (Responsável: ${guardian.nome})`, { registroId: guardian.key, detalhesDepois: form })
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
       existingAuth = handleCreateAuth(resetModal.guardian)
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

    logSystemAction('Config (Acessos)', 'Edição', `Redefinição de acesso (Responsável: ${resetModal.guardian.nome})`, { registroId: existingAuth.id })
    setResetModal(null)
  }

  const toggleStatus = (guardian: any) => {
    const auth = guardian.auth || handleCreateAuth(guardian)
    const newStatus = auth.status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
    setAuthUsers(prev => prev.map(u => u.id === auth.id ? { ...u, status: newStatus } : u))
    logSystemAction('Config (Acessos)', 'Edição', `Alteração de status de acesso (Responsável: ${guardian.nome}) -> ${newStatus}`, { registroId: auth.id, detalhesDepois: { status: newStatus } })
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
          <input className="form-input" placeholder="Buscar por responsável ou CPF..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
      </div>

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
                    <td style={{ fontSize: 12, color: g.auth?.last_login ? 'inherit' : 'hsl(var(--text-muted))' }}>{g.auth?.last_login || 'Nunca acessou'}</td>
                    <td>{badgeStatus(currentStatus)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Editar Contatos de Acesso" onClick={() => setEditModal({ guardian: g, auth: g.auth, form: { email: g.email || g.auth?.email || '', celular: g.celular || g.telefone || g.auth?.celular || '' } })}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Redefinir Senha" onClick={() => { setResetModal({ guardian: g, auth: g.auth }); setResetParams({ mode: 'auto', password: generateAutoPass(), confirm: '', sendSms: false, sendEmail: false, requireChange: true }); setCopied(false) }}><Key size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title={currentStatus === 'ATIVO' ? 'Inativar Acesso' : 'Ativar Acesso'} onClick={() => toggleStatus(g)}><Power size={13} style={{ color: currentStatus === 'ATIVO' ? '#ef4444' : '#10b981' }} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Alunos Vinculados Modal */}
      {linksModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Alunos Vinculados</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{linksModal.nome}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setLinksModal(null)}>×</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 12 }}>
              {linksModal.alunos.map((a: any) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8 }}>
                  <div className="avatar" style={{ width: 28, height: 28, background: '#6366f120', color: '#6366f1', fontSize: 10, borderRadius: 6 }}>{getInitials(a.nome)}</div>
                  <div style={{ flex: 1 }}>
                     <div style={{ fontSize: 13, fontWeight: 700 }}>{a.nome}</div>
                     <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Turma: {a.turma || '-'}</div>
                  </div>
                  <div><code style={{ fontSize: 10, padding: '2px 6px', background: 'hsl(var(--bg-overlay))', borderRadius: 4 }}>{(a as any).codigo || (a as any).matricula || a.id.substring(0,8)}</code></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (similar to Students) */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
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
          </div>
        </div>
      )}

      {/* Reset Password Modal (similar to Students) */}
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
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
          </div>
        </div>
      )}
    </div>
  )
}
