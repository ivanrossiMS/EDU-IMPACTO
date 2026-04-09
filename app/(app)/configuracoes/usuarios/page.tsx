'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Shield, Eye, Pencil, Trash2, Lock, X, Save, ChevronDown, ChevronRight, GraduationCap, Users, RotateCcw, Layers } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { newId, useData, Perfil } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { AuthAlunosTab } from '@/components/usuarios/AuthAlunosTab'
import { AuthResponsaveisTab } from '@/components/usuarios/AuthResponsaveisTab'
import { ALL_NAV_GROUPS } from '@/components/layout/Sidebar'

interface ModulePage { key: string; label: string }
interface ModuleGroup { key: string; label: string; icon: React.ReactNode; pages: ModulePage[] }

const toSlug = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-')

const MODULES_CONFIG: ModuleGroup[] = ALL_NAV_GROUPS.map(g => ({
  key: g.moduleKey || toSlug(g.title),
  label: g.title,
  icon: g.icon,
  pages: g.items.flatMap(item => {
    if (item.children) {
      return item.children.map(child => ({ key: child.href || toSlug(child.label), label: `${item.label} > ${child.label}` }))
    }
    return [{ key: item.href || toSlug(item.label), label: item.label }]
  })
}))




/* ─── Types ─────────────────────────────────────── */
interface SysUser {
  id: string; nome: string; email: string; cargo: string
  perfil: string; status: 'ativo' | 'inativo'; twofa: boolean; ultimoAcesso: string
}


// ALL_MODULOS is computed per-render from activeModules (see below)

const BLANK_USER: Omit<SysUser, 'id' | 'ultimoAcesso'> = {
  nome: '', email: '', cargo: '', perfil: 'Professor', status: 'ativo', twofa: false,
}

// Helper: Modern Premium Switch Component
const ModernSwitch = ({ checked, onChange, disabled, color }: { checked: boolean, onChange: () => void, disabled?: boolean, color?: string }) => (
  <div 
    onClick={(e) => { e.stopPropagation(); if(!disabled) onChange(); }}
    style={{
      width: 36, height: 20, borderRadius: 20,
      background: checked ? (color || 'hsl(var(--primary))') : 'hsl(var(--border-strong))',
      position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      opacity: disabled ? 0.5 : 1,
      flexShrink: 0
    }}
  >
    <div style={{
      width: 16, height: 16, borderRadius: '50%', background: '#fff',
      position: 'absolute', top: 2, left: checked ? 18 : 2,
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}/>
  </div>
)

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '24px 20px', overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: wide ? 760 : 580, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', marginBottom: 24 }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'hsl(var(--bg-surface))', zIndex: 1, borderRadius: '18px 18px 0 0' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={16} /></button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

export default function UsuariosPage() {
  const [tab, setTab] = useState<'usuarios' | 'alunos' | 'responsaveis' | 'perfis' | 'logs' | 'tipos-conta'>('usuarios')
  const { activeModules, currentUserPerfil } = useApp()
  const isDiretorGeral = currentUserPerfil === 'Diretor Geral'

  // Perfil editor always shows ALL modules (active state doesn't restrict editing)
  const activeModulosKeys = MODULES_CONFIG

  /* Persist everything */
  const [users, setUsers] = useLocalStorage<SysUser[]>('edu-sys-users', [])
  // Carregar dados online no load da página
  useEffect(() => {
    fetch('/api/configuracoes/usuarios', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data as SysUser[]);
      })
      .catch(console.error)
  }, [])

  const [authUsers] = useLocalStorage<any[]>('edu-auth-users', [])

  const { alunos, logSystemAction, perfis, setPerfis } = useData()

  // Calcula o total virtual de usuários da Família (alunos + responsáveis únicos)
  const totalFamiliaUsuarios = useMemo(() => {
    let guardianKeys = new Set<string>()
    ;(alunos || []).forEach(aluno => {
      const parseG = (g: any) => {
        if (!g.nome) return
        guardianKeys.add(g.cpf || g.email || g.nome)
      }
      if ((aluno as any)._responsaveis && Array.isArray((aluno as any)._responsaveis)) {
        (aluno as any)._responsaveis.forEach(parseG)
      } else if ((aluno as any).responsaveis && Array.isArray((aluno as any).responsaveis)) {
        (aluno as any).responsaveis.forEach(parseG)
      } else if (aluno.responsavel) {
        guardianKeys.add((aluno as any).cpf_responsavel || (aluno as any).cpfResponsavel || aluno.responsavel)
      }
    })
    return (alunos || []).length + guardianKeys.size
  }, [alunos])

  /* User CRUD state */
  const [userModal, setUserModal] = useState<'add' | 'edit' | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [userForm, setUserForm] = useState<Omit<SysUser, 'id' | 'ultimoAcesso'>>(BLANK_USER)
  const [showUser, setShowUser] = useState<SysUser | null>(null)
  const [isSavingUser, setIsSavingUser] = useState(false)

  /* Perfil CRUD state */
  const [perfilModal, setPerfilModal] = useState<'add' | 'edit' | null>(null)
  const [editingPerfilId, setEditingPerfilId] = useState<string | null>(null)
  const [deletePerfilId, setDeletePerfilId] = useState<string | null>(null)
  const [perfilForm, setPerfilForm] = useState<Omit<Perfil, 'id'>>({ nome: '', cor: '#3b82f6', descricao: '', permissoes: [] })
  const [expandedModulos, setExpandedModulos] = useState<string[]>([])

  /* ── User actions ── */
  const openAddUser = () => { setUserForm(BLANK_USER); setUserModal('add') }
  const openEditUser = (u: SysUser) => { setUserForm({ nome: u.nome, email: u.email, cargo: u.cargo, perfil: u.perfil, status: u.status, twofa: u.twofa }); setEditingUserId(u.id); setUserModal('edit') }
  const saveUser = async () => {
    if (!userForm.nome.trim() || !userForm.email.trim() || isSavingUser) return
    setIsSavingUser(true)
    if (userModal === 'add') {
      const uId = newId('U')
      const payload = { ...userForm, id: uId, ultimoAcesso: 'Nunca' }
      try {
        const res = await fetch('/api/configuracoes/usuarios', { method: 'POST', body: JSON.stringify(payload) })
        if (!res.ok) { const err = await res.json(); alert('Erro na nuvem: ' + err.error); setIsSavingUser(false); return; }
      } catch(e) { alert('Erro critico ao salvar usuario'); setIsSavingUser(false); return; }
      
      setUsers(prev => [...prev, payload])
      logSystemAction('Config (Usuários)', 'Cadastro', `Novo usuário: ${userForm.nome}`, { registroId: uId, detalhesDepois: userForm })
    } else if (editingUserId) {
      try {
        const res = await fetch(`/api/configuracoes/usuarios/${editingUserId}`, { method: 'PUT', body: JSON.stringify(userForm) })
        if (!res.ok) { const err = await res.json(); alert('Erro na nuvem (Netlify/Local): ' + err.error); setIsSavingUser(false); return; }
      } catch(e) { alert('Erro critico ao atualizar'); setIsSavingUser(false); return; }

      setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...userForm } : u))
      logSystemAction('Config (Usuários)', 'Edição', `Atualização do usuário ${userForm.nome}`, { registroId: editingUserId, detalhesDepois: userForm })
    }
    setUserModal(null); setEditingUserId(null); setIsSavingUser(false)
  }
  const deleteUser = async () => {
    if (deleteUserId) {
      try {
        const res = await fetch(`/api/configuracoes/usuarios/${deleteUserId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Falha no db')
      } catch(e) { alert('Falha ao excluir online'); return; }

      const uDel = users.find(u => u.id === deleteUserId)
      setUsers(prev => prev.filter(u => u.id !== deleteUserId))
      logSystemAction('Config (Usuários)', 'Exclusão', `Exclusão do usuário ${uDel?.nome}`, { registroId: deleteUserId, detalhesAntes: uDel })
      setDeleteUserId(null)
    }
  }

  const reiniciarAcesso = (uid: string) => {
    if (!confirm('Deseja reiniciar o primeiro acesso deste usuário? Ele perderá a senha atual e precisará criar uma nova passnword no primeiro acesso.')) return;
    try {
      const p = JSON.parse(localStorage.getItem('edu-user-passwords') || '{}');
      if (p[uid]) {
        delete p[uid];
        localStorage.setItem('edu-user-passwords', JSON.stringify(p));
        alert('Primeiro acesso reiniciado com sucesso! O usuário pode configurá-lo novamente através da tela de Login.');
      } else {
        alert('Este usuário ainda não configurou uma senha / primeiro acesso.');
      }
    } catch (e) {
      alert('Erro ao limpar a senha.');
    }
  }

  /* ── Perfil actions ── */
  const openAddPerfil = () => { setPerfilForm({ nome: '', cor: '#3b82f6', descricao: '', permissoes: [] }); setPerfilModal('add') }
  const openEditPerfil = (p: any) => { setPerfilForm({ nome: p.nome, cor: p.cor, descricao: p.descricao, permissoes: [...p.permissoes] }); setEditingPerfilId(p.id); setPerfilModal('edit') }
  const savePerfil = () => {
    if (!perfilForm.nome.trim()) return
    if (perfilModal === 'add') {
      const pId = newId('PERF')
      setPerfis(prev => [...prev, { ...perfilForm, id: pId } as Perfil])
      logSystemAction('Config (Usuários)', 'Cadastro', `Novo perfil: ${perfilForm.nome}`, { registroId: pId, detalhesDepois: perfilForm })
    } else if (editingPerfilId) {
      setPerfis(prev => prev.map(p => p.id === editingPerfilId ? { ...perfilForm, id: editingPerfilId } as Perfil : p))
      logSystemAction('Config (Usuários)', 'Edição', `Atualização do perfil ${perfilForm.nome}`, { registroId: editingPerfilId, detalhesDepois: perfilForm })
    }
    setPerfilModal(null); setEditingPerfilId(null)
  }
  const deletePerfil = () => {
    if (deletePerfilId) {
      const pDel = (perfis || []).find(p => p.id === deletePerfilId)
      setPerfis(prev => (prev || []).filter(p => p.id !== deletePerfilId))
      logSystemAction('Config (Usuários)', 'Exclusão', `Exclusão do perfil ${pDel?.nome}`, { registroId: deletePerfilId, detalhesAntes: pDel })
      setDeletePerfilId(null)
    }
  }
  const togglePermissao = (key: string) => {
    setPerfilForm(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(key) ? prev.permissoes.filter(m => m !== key) : [...prev.permissoes, key],
    }))
  }

  const toggleModulo = (mod: ModuleGroup) => {
    const allKeys = [mod.key, ...mod.pages.map(p => p.key)]
    const allOn = allKeys.every(k => perfilForm.permissoes.includes(k))
    setPerfilForm(prev => ({
      ...prev,
      permissoes: allOn
        ? prev.permissoes.filter(m => !allKeys.includes(m))
        : [...new Set([...prev.permissoes, ...allKeys])],
    }))
  }

  const perfilByName = (name: string) => (perfis || []).find(p => p.nome === name)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuários & Acessos</h1>
          <p className="page-subtitle">Controle de usuários, perfis, permissões e auditoria de acesso</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAddUser}><Plus size={13} />Novo Usuário</button>
      </div>

      <div className="tab-list" style={{ marginBottom: 20, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'tipos-conta' ? 'active' : ''}`} onClick={() => setTab('tipos-conta')}><Layers size={12} />Tipos de Conta</button>
        <button className={`tab-trigger ${tab === 'usuarios' ? 'active' : ''}`} onClick={() => setTab('usuarios')}><Shield size={12} />Colaboradores</button>
        <button className={`tab-trigger ${tab === 'alunos' ? 'active' : ''}`} onClick={() => setTab('alunos')}><GraduationCap size={12} />Alunos</button>
        <button className={`tab-trigger ${tab === 'responsaveis' ? 'active' : ''}`} onClick={() => setTab('responsaveis')}><Users size={12} />Responsáveis</button>
        <button className={`tab-trigger ${tab === 'perfis' ? 'active' : ''}`} onClick={() => setTab('perfis')}><Lock size={12} />Perfis & Permissões</button>
        <button className={`tab-trigger ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>📋 Logs de Acesso</button>
      </div>

      {/* ── USUÁRIOS ── */}
      {tab === 'usuarios' && (
        users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'hsl(var(--text-muted))' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum usuário cadastrado</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Adicione usuários para controlar o acesso à plataforma</div>
            <button className="btn btn-primary" onClick={openAddUser}><Plus size={13} />Inserir primeiro usuário</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Usuário</th><th>Cargo</th><th>Perfil</th><th>Último Acesso</th><th>2FA</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {users.filter(u => !u.id.startsWith('virtual-')).length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>Nenhum colaborador real cadastrado.</td></tr>
                ) : (
                  users.filter(u => !u.id.startsWith('virtual-')).map(u => {
                    const p = perfilByName(u.perfil)
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{u.nome}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{u.email}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{u.cargo || '—'}</td>
                      <td>
                        <span className="badge badge-primary" style={{ background: p ? `${p.cor}20` : undefined, color: p?.cor }}>{u.perfil}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{u.ultimoAcesso || '—'}</td>
                      <td>{u.twofa ? <span className="badge badge-success"><Shield size={9} />Ativo</span> : <span className="badge badge-neutral">Inativo</span>}</td>
                      <td><span className={`badge ${u.status === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{u.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Ver detalhes" onClick={() => setShowUser(u)}><Eye size={12} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEditUser(u)}><Pencil size={12} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Reiniciar 1º Acesso" onClick={() => reiniciarAcesso(u.id)}><RotateCcw size={12} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Excluir" style={{ color: '#f87171' }} onClick={() => setDeleteUserId(u.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── ALUNOS & RESPONSÁVEIS ── */}
      {tab === 'alunos' && <AuthAlunosTab />}
      {tab === 'responsaveis' && <AuthResponsaveisTab />}

      {/* ── TIPOS DE CONTA ── */}
      {tab === 'tipos-conta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ padding: '24px 32px', borderRadius: 20, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#ffffff', boxShadow: '0 12px 32px rgba(124,58,237,0.2)' }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#ffffff', letterSpacing: '-0.02em' }}>Tipos de Credenciais</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', maxWidth: 600, lineHeight: 1.6 }}>O Impacto Edu utiliza uma arquitetura unificada de identidades para garantir o acesso correto a todos os perfis do ecossistema educacional.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { 
                icon: '🛡️', title: 'Colaboradores', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',
                desc: 'Diretores, professores e funcionários admin que gerenciam a instituição.',
                features: ['Acesso ao Enterprise ERP', 'Gerenciamento de Módulos (RH, Financeiro)', 'Permissões granulares por cargo']
              },
              { 
                icon: '🎓', title: 'Alunos', color: '#10b981', bg: 'rgba(16,185,129,0.08)',
                desc: 'Acesso da ponta para os estudantes acompanharem seu desempenho acadêmico.',
                features: ['Acesso à Portal do Aluno/Agenda', 'Material Didático & Tarefas', 'Boletim em tempo real']
              },
              { 
                icon: '👥', title: 'Responsáveis', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',
                desc: 'Acesso para pais/guardiões acompanharem os alunos e pendências financeiras.',
                features: ['Pagamento de Mensalidades', 'Agenda, Ocorrências e Avisos', 'Vínculo com múltiplos filhos']
              }
            ].map(type => (
              <div key={type.title} className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: type.bg, filter: 'blur(40px)', borderRadius: '50%', transform: 'translate(30%, -30%)' }} />
                <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: 'hsl(var(--bg-elevated))', boxShadow: '0 8px 16px rgba(0,0,0,0.05)', zIndex: 1 }}>{type.icon}</div>
                <div style={{ zIndex: 1 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>{type.title}</h3>
                  <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5, minHeight: 40 }}>{type.desc}</p>
                </div>
                <div style={{ background: 'hsl(var(--bg-elevated))', padding: '16px 20px', borderRadius: 12, marginTop: 'auto', border: '1px solid hsl(var(--border-subtle))', zIndex: 1 }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {type.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-primary))', fontWeight: 500 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: type.color }} /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PERFIS & PERMISSÕES ── */}
      {tab === 'perfis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={openAddPerfil}><Plus size={13} />Novo Perfil</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {perfis.map(p => (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(180deg, hsl(var(--bg-surface)) 0%, hsl(var(--bg-base)) 100%)' }}>
                 <div style={{ height: 4, background: p.cor }} />
                 <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${p.cor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${p.cor}15` }}>
                        <Shield size={22} color={p.cor} />
                      </div>
                      <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--bg-elevated))', borderRadius: 8, padding: 4, border: '1px solid hsl(var(--border-subtle))' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditPerfil(p)}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#ef4444' }} onClick={() => setDeletePerfilId(p.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: 'hsl(var(--text-primary))' }}>{p.nome}</div>
                    <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5, marginBottom: 20 }}>{p.descricao}</div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                        <div style={{ flex: 1 }}>
                           <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Membros</div>
                           <div style={{ fontSize: 20, fontWeight: 900, color: p.cor, display: 'flex', alignItems: 'center', gap: 8 }}>
                             {users.filter(u => u.perfil === p.nome).length + (p.nome === 'Família' ? totalFamiliaUsuarios : 0)}
                             <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))', background: `${p.cor}15`, padding: '2px 8px', borderRadius: 10 }}>Ativos</span>
                           </div>
                        </div>
                        <div style={{ width: 1, height: 32, background: 'hsl(var(--border-subtle))' }} />
                        <div style={{ flex: 1 }}>
                           <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Restrições</div>
                           <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', marginTop: 4 }}>
                             {p.nome === 'Diretor Geral' ? 'Acesso Livre' : `${p.permissoes.length} Módulos`}
                           </div>
                        </div>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LOGS ── */}
      {tab === 'logs' && (
        <div className="table-container">
          <table>
            <thead><tr><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Data/Hora</th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))' }}>Nenhum log registrado. Adicione usuários ao sistema.</td></tr>
              ) : (
                users.slice(0, 5).map((u, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{u.nome}</td>
                    <td style={{ fontSize: 12 }}>Login</td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>Dashboard</span></td>
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{u.ultimoAcesso || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODALS ── */}
      {/* User Add/Edit */}
      {userModal && (
        <Modal title={userModal === 'add' ? 'Novo Usuário' : 'Editar Usuário'} onClose={() => setUserModal(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Nome completo *</label><input className="form-input" value={userForm.nome} onChange={e => setUserForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Dr. João Silva" /></div>
              <div><label className="form-label">E-mail *</label><input className="form-input" type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} placeholder="joao@escola.com" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Cargo</label><input className="form-input" value={userForm.cargo} onChange={e => setUserForm(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Diretor" /></div>
              <div><label className="form-label">Perfil de acesso *</label>
                <select className="form-input" value={userForm.perfil} onChange={e => setUserForm(p => ({ ...p, perfil: e.target.value }))}>
                  {perfis.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Status</label>
                <select className="form-input" value={userForm.status} onChange={e => setUserForm(p => ({ ...p, status: e.target.value as 'ativo' | 'inativo' }))}>
                  <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
                <input type="checkbox" id="twofa" checked={userForm.twofa} onChange={e => setUserForm(p => ({ ...p, twofa: e.target.checked }))} />
                <label htmlFor="twofa" style={{ fontSize: 13, cursor: 'pointer' }}>Exigir autenticação 2FA</label>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setUserModal(null)} disabled={isSavingUser}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveUser} disabled={isSavingUser} style={{ opacity: isSavingUser ? 0.7 : 1 }}>
              <Save size={13} />{isSavingUser ? 'Salvando...' : (userModal === 'add' ? 'Inserir Usuário' : 'Salvar alterações')}
            </button>
          </div>
        </Modal>
      )}

      {/* Perfil Add/Edit */}
      {perfilModal && (
        <Modal title={perfilModal === 'add' ? 'Novo Perfil de Acesso' : 'Editar Perfil'} onClose={() => setPerfilModal(null)} wide>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
              <div><label className="form-label">Nome do perfil *</label><input className="form-input" value={perfilForm.nome} onChange={e => setPerfilForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Coordenador Pedagógico" /></div>
              <div><label className="form-label">Cor</label><input type="color" value={perfilForm.cor} onChange={e => setPerfilForm(p => ({ ...p, cor: e.target.value }))} style={{ width: 48, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2, background: 'transparent' }} /></div>
            </div>
            <div><label className="form-label">Descrição</label><input className="form-input" value={perfilForm.descricao} onChange={e => setPerfilForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Resumo das permissões..." /></div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Permissões por Módulo e Página</label>
                {isDiretorGeral && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => {
                          const allKeys = MODULES_CONFIG.flatMap((m: any) => [m.key, ...m.pages.map((p: any) => p.key)])
                          setPerfilForm(p => ({ ...p, permissoes: allKeys }))
                      }}
                    >
                      Marcar Todas
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ fontSize: 11, padding: '2px 8px', color: '#ef4444' }}
                      onClick={() => setPerfilForm(p => ({ ...p, permissoes: [] }))}
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                )}
              </div>
                      {!isDiretorGeral && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, marginBottom: 10, fontSize: 12, color: '#fbbf24' }}>
                  <Lock size={12} /> Apenas o Diretor Geral pode editar permissões de módulo.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {MODULES_CONFIG.map((m: any) => {
                  const allKeys = [m.key, ...m.pages.map((p: any) => p.key)]
                  const allChecked = allKeys.every(k => perfilForm.permissoes.includes(k))
                  const someChecked = allKeys.some(k => perfilForm.permissoes.includes(k)) && !allChecked
                  const checkedCount = allKeys.filter(k => perfilForm.permissoes.includes(k)).length
                  const isExpanded = expandedModulos.includes(m.key)
                  const toggleExpand = () => setExpandedModulos(prev => prev.includes(m.key) ? prev.filter(k => k !== m.key) : [...prev, m.key])
                  
                  return (
                    <div key={m.key} style={{
                      border: `1px solid ${allChecked ? perfilForm.cor + '40' : someChecked ? perfilForm.cor + '20' : 'hsl(var(--border-subtle))'}`,
                      borderRadius: 14,
                      background: allChecked ? `${perfilForm.cor}06` : someChecked ? `${perfilForm.cor}03` : 'hsl(var(--bg-elevated))',
                      overflow: 'hidden',
                      boxShadow: allChecked ? `0 4px 12px ${perfilForm.cor}10` : '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s',
                    }}>
                      {/* Header do módulo */}
                      <div
                        onClick={toggleExpand}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        {/* Toggle master */}
                        <div onClick={e => e.stopPropagation()}>
                          <ModernSwitch 
                            checked={allChecked} 
                            onChange={() => isDiretorGeral && toggleModulo(m)} 
                            disabled={!isDiretorGeral} 
                            color={perfilForm.cor}
                          />
                        </div>
                        
                        {/* Ícone */}
                        <div style={{ 
                          width: 32, height: 32, borderRadius: 8, 
                          background: allChecked ? `${perfilForm.cor}15` : 'hsl(var(--bg-overlay))',
                          color: allChecked ? perfilForm.cor : 'hsl(var(--text-muted))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, transition: 'all 0.2s'
                        }}>
                          {m.icon}
                        </div>

                        {/* Nome do módulo */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: allChecked ? perfilForm.cor : 'hsl(var(--text-primary))' }}>{m.label}</span>
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                            {allChecked ? 'Acesso Integrado' : someChecked ? 'Acesso Parcial' : 'Sem Acesso'}
                          </span>
                        </div>

                        {/* Contador */}
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          padding: '4px 10px', borderRadius: 20,
                          background: checkedCount > 0 ? `${perfilForm.cor}15` : 'hsl(var(--bg-overlay))',
                          color: checkedCount > 0 ? perfilForm.cor : 'hsl(var(--text-muted))',
                          minWidth: 50, textAlign: 'center'
                        }}>{checkedCount} / {allKeys.length}</span>

                        {/* Chevron */}
                        <span style={{ color: 'hsl(var(--text-muted))', flexShrink: 0, display: 'flex', paddingLeft: 6 }}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </span>
                      </div>

                      {/* Sub-páginas */}
                      {isExpanded && m.pages.length > 0 && (
                        <div style={{
                          borderTop: `1px solid ${perfilForm.cor}15`,
                          padding: '16px 18px',
                          background: 'hsl(var(--bg-base))',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                          gap: 12
                        }}>
                          {m.pages.map((p: any) => {
                            const isChecked = perfilForm.permissoes.includes(p.key)
                            return (
                              <div
                                key={p.key}
                                onClick={() => isDiretorGeral && togglePermissao(p.key)}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                  padding: '10px 14px', borderRadius: 10,
                                  cursor: isDiretorGeral ? 'pointer' : 'not-allowed',
                                  background: isChecked ? `${perfilForm.cor}10` : 'hsl(var(--bg-overlay))',
                                  border: `1px solid ${isChecked ? perfilForm.cor + '30' : 'transparent'}`,
                                  transition: 'all 0.15s ease-out'
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: isChecked ? 600 : 500, color: isChecked ? perfilForm.cor : 'hsl(var(--text-secondary))', lineHeight: 1.2, flex: 1 }}>
                                  {p.label.split(' > ').pop()}
                                </span>
                                <ModernSwitch 
                                  checked={isChecked} 
                                  onChange={() => {}} // Handle inside parent onClick
                                  disabled={!isDiretorGeral} 
                                  color={perfilForm.cor}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setPerfilModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={savePerfil} disabled={!isDiretorGeral}><Save size={13} />{perfilModal === 'add' ? 'Criar Perfil' : 'Salvar Perfil'}</button>
          </div>
        </Modal>
      )}

      {/* User details view */}
      {showUser && (
        <Modal title="Detalhes do usuário" onClose={() => setShowUser(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            {[['Nome', showUser.nome], ['E-mail', showUser.email], ['Cargo', showUser.cargo || '—'], ['Perfil', showUser.perfil], ['Status', showUser.status], ['2FA', showUser.twofa ? 'Ativo' : 'Inativo'], ['Último acesso', showUser.ultimoAcesso || '—']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', width: 120, flexShrink: 0 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Confirm delete user */}
      {deleteUserId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '28px', maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Excluir usuário?</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>O usuário será removido permanentemente.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteUserId(null)}>Cancelar</button>
              <button style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, cursor: 'pointer' }} onClick={deleteUser}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete perfil */}
      {deletePerfilId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '28px', maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Excluir perfil?</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>O perfil será removido. Usuários com este perfil não serão afetados.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeletePerfilId(null)}>Cancelar</button>
              <button style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, cursor: 'pointer' }} onClick={deletePerfil}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
