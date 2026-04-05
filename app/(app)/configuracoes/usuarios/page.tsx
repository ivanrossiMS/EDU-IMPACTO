'use client'

import { useState, useMemo } from 'react'
import { Plus, Shield, Eye, Pencil, Trash2, Lock, X, Save, ChevronDown, ChevronRight, GraduationCap, Users } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { newId, useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { AuthAlunosTab } from '@/components/usuarios/AuthAlunosTab'
import { AuthResponsaveisTab } from '@/components/usuarios/AuthResponsaveisTab'

interface ModulePage { key: string; label: string }
interface ModuleGroup { key: string; label: string; icon: string; pages: ModulePage[] }

const MODULES_CONFIG: ModuleGroup[] = [
  { key: 'dashboard',      icon: '🏠', label: 'Dashboard',           pages: [{ key: 'dashboard', label: 'Painel Principal' }] },
  { key: 'academico',      icon: '🎓', label: 'Acadêmico',           pages: [
    { key: 'academico.alunos', label: 'Alunos' },
    { key: 'academico.turmas', label: 'Turmas' },
    { key: 'academico.diario', label: 'Diário de Classe' },
    { key: 'academico.notas', label: 'Notas & Avaliações' },
    { key: 'academico.frequencia', label: 'Frequência' },
    { key: 'academico.materias', label: 'Matérias' },
    { key: 'academico.horarios', label: 'Horários' },
    { key: 'academico.planejamento', label: 'Planejamento' },
  ]},
  { key: 'financeiro',     icon: '💰', label: 'Financeiro',          pages: [
    { key: 'financeiro.receber', label: 'Contas a Receber' },
    { key: 'financeiro.pagar', label: 'Contas a Pagar' },
    { key: 'financeiro.caixa', label: 'Abertura de Caixa' },
    { key: 'financeiro.movimentacoes', label: 'Movimentações' },
    { key: 'financeiro.boletos', label: 'Boletos & Convênio' },
    { key: 'financeiro.nf', label: 'Emissão de NF' },
    { key: 'financeiro.dre', label: 'DRE' },
    { key: 'financeiro.inadimplencia', label: 'Inadimplência' },
  ]},
  { key: 'rh',             icon: '👤', label: 'Recursos Humanos',    pages: [
    { key: 'rh.funcionarios', label: 'Funcionários' },
    { key: 'rh.folha', label: 'Folha de Pagamento' },
    { key: 'rh.ponto', label: 'Controle de Ponto' },
    { key: 'rh.ferias', label: 'Férias & Afastamentos' },
    { key: 'rh.avaliacao', label: 'Avaliação de Desempenho' },
  ]},
  { key: 'crm',            icon: '🎯', label: 'CRM & Captação',      pages: [
    { key: 'crm.leads', label: 'Funil de Leads' },
    { key: 'crm.agendamentos', label: 'Agendamentos' },
    { key: 'crm.retencao', label: 'Retenção & Evasão' },
    { key: 'crm.rematricula', label: 'Rematrícula' },
  ]},

  { key: 'administrativo', icon: '🗂️', label: 'Administrativo',      pages: [
    { key: 'administrativo.almoxarifado', label: 'Almoxarifado' },
    { key: 'administrativo.patrimonio', label: 'Patrimônio' },
    { key: 'administrativo.manutencao', label: 'Manutenção' },
    { key: 'administrativo.fornecedores', label: 'Fornecedores' },
  ]},
  { key: 'bi',             icon: '📊', label: 'BI & Análises',       pages: [
    { key: 'bi.overview', label: 'Visão Geral' },
    { key: 'bi.academico', label: 'BI Acadêmico' },
    { key: 'bi.financeiro', label: 'BI Financeiro' },
    { key: 'bi.crm', label: 'BI CRM' },
  ]},
  { key: 'ia',             icon: '🤖', label: 'Inteligência IA',     pages: [
    { key: 'ia.copilotos', label: 'Copilotos' },
    { key: 'ia.previsoes', label: 'Previsões' },
    { key: 'ia.relatorios', label: 'Relatórios IA' },
  ]},
  { key: 'configuracoes',  icon: '⚙️', label: 'Configurações',       pages: [
    { key: 'configuracoes.usuarios', label: 'Usuários & Acessos' },
    { key: 'configuracoes.financeiro', label: 'Config. Financeiro' },
    { key: 'configuracoes.pedagogico', label: 'Config. Pedagógico' },
    { key: 'configuracoes.unidades', label: 'Unidades' },
    { key: 'configuracoes.integracoes', label: 'Integrações' },
  ]},

  { key: 'relatorios',     icon: '📑', label: 'Relatórios Gov.',      pages: [{ key: 'relatorios.censo', label: 'Censo Escolar' }, { key: 'relatorios.educacenso', label: 'Educacenso' }] },
]

/* ─── Types ─────────────────────────────────────── */
interface SysUser {
  id: string; nome: string; email: string; cargo: string
  perfil: string; status: 'ativo' | 'inativo'; twofa: boolean; ultimoAcesso: string
}

interface Perfil {
  id: string; nome: string; cor: string
  permissoes: string[]; descricao: string
}

const DEFAULT_PERFIS: Perfil[] = [
  { id: 'P1', nome: 'Diretor Geral', cor: '#ef4444', descricao: 'Acesso total ao sistema', permissoes: ['dashboard','academico','financeiro','rh','crm','administrativo','bi','relatorios','configuracoes','multi-unidades'] },
  { id: 'P2', nome: 'Coordenador', cor: '#f59e0b', descricao: 'Área pedagógica e RH', permissoes: ['dashboard','academico','rh'] },
  { id: 'P3', nome: 'Secretária', cor: '#3b82f6', descricao: 'Secretaria e acadêmico', permissoes: ['dashboard','academico'] },
  { id: 'P4', nome: 'Professor', cor: '#10b981', descricao: 'Diário, notas e frequência', permissoes: ['dashboard','academico'] },
  { id: 'P5', nome: 'Financeiro', cor: '#8b5cf6', descricao: 'Módulo financeiro e relatórios', permissoes: ['dashboard','financeiro','relatorios'] },
]



// ALL_MODULOS is computed per-render from activeModules (see below)

const BLANK_USER: Omit<SysUser, 'id' | 'ultimoAcesso'> = {
  nome: '', email: '', cargo: '', perfil: 'Professor', status: 'ativo', twofa: false,
}

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
  const [tab, setTab] = useState<'usuarios' | 'alunos' | 'responsaveis' | 'perfis' | 'logs'>('usuarios')
  const { activeModules, currentUserPerfil } = useApp()
  const isDiretorGeral = currentUserPerfil === 'Diretor Geral'

  // Perfil editor always shows ALL modules (active state doesn't restrict editing)
  const activeModulosKeys = MODULES_CONFIG

  /* Persist everything */
  const [users, setUsers] = useLocalStorage<SysUser[]>('edu-sys-users', [])
  // Carregar dados online no load da página
  import('react').then(R => R.useEffect(() => {
    fetch('/api/configuracoes/usuarios')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setUsers(data as SysUser[]);
      })
      .catch(console.error)
  }, []))

  const [perfis, setPerfis] = useLocalStorage<Perfil[]>('edu-sys-perfis', DEFAULT_PERFIS)
  const [authUsers] = useLocalStorage<any[]>('edu-auth-users', [])

  const { alunos, logSystemAction } = useData()

  // Calcula o total virtual de usuários da Família (alunos + responsáveis únicos)
  const totalFamiliaUsuarios = useMemo(() => {
    let guardianKeys = new Set<string>()
    alunos.forEach(aluno => {
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
    return alunos.length + guardianKeys.size
  }, [alunos])

  /* User CRUD state */
  const [userModal, setUserModal] = useState<'add' | 'edit' | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [userForm, setUserForm] = useState<Omit<SysUser, 'id' | 'ultimoAcesso'>>(BLANK_USER)
  const [showUser, setShowUser] = useState<SysUser | null>(null)

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
    if (!userForm.nome.trim() || !userForm.email.trim()) return
    if (userModal === 'add') {
      const uId = newId('U')
      const payload = { ...userForm, id: uId, ultimoAcesso: 'Nunca' }
      try { await fetch('/api/configuracoes/usuarios', { method: 'POST', body: JSON.stringify(payload) }) } catch(e){}
      setUsers(prev => [...prev, payload])
      logSystemAction('Config (Usuários)', 'Cadastro', `Novo usuário: ${userForm.nome}`, { registroId: uId, detalhesDepois: userForm })
    } else if (editingUserId) {
      try { await fetch(`/api/configuracoes/usuarios/${editingUserId}`, { method: 'PUT', body: JSON.stringify(userForm) }) } catch(e) {}
      setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...userForm } : u))
      logSystemAction('Config (Usuários)', 'Edição', `Atualização do usuário ${userForm.nome}`, { registroId: editingUserId, detalhesDepois: userForm })
    }
    setUserModal(null); setEditingUserId(null)
  }
  const deleteUser = async () => {
    if (deleteUserId) {
      try { await fetch(`/api/configuracoes/usuarios/${deleteUserId}`, { method: 'DELETE' }) } catch(e) {}
      const uDel = users.find(u => u.id === deleteUserId)
      setUsers(prev => prev.filter(u => u.id !== deleteUserId))
      logSystemAction('Config (Usuários)', 'Exclusão', `Exclusão do usuário ${uDel?.nome}`, { registroId: deleteUserId, detalhesAntes: uDel })
      setDeleteUserId(null)
    }
  }

  /* ── Perfil actions ── */
  const openAddPerfil = () => { setPerfilForm({ nome: '', cor: '#3b82f6', descricao: '', permissoes: [] }); setPerfilModal('add') }
  const openEditPerfil = (p: Perfil) => { setPerfilForm({ nome: p.nome, cor: p.cor, descricao: p.descricao, permissoes: [...p.permissoes] }); setEditingPerfilId(p.id); setPerfilModal('edit') }
  const savePerfil = () => {
    if (!perfilForm.nome.trim()) return
    if (perfilModal === 'add') {
      const pId = newId('PERF')
      setPerfis(prev => [...prev, { ...perfilForm, id: pId }])
      logSystemAction('Config (Usuários)', 'Cadastro', `Novo perfil: ${perfilForm.nome}`, { registroId: pId, detalhesDepois: perfilForm })
    } else if (editingPerfilId) {
      setPerfis(prev => prev.map(p => p.id === editingPerfilId ? { ...perfilForm, id: editingPerfilId } : p))
      logSystemAction('Config (Usuários)', 'Edição', `Atualização do perfil ${perfilForm.nome}`, { registroId: editingPerfilId, detalhesDepois: perfilForm })
    }
    setPerfilModal(null); setEditingPerfilId(null)
  }
  const deletePerfil = () => {
    if (deletePerfilId) {
      const pDel = perfis.find(p => p.id === deletePerfilId)
      setPerfis(prev => prev.filter(p => p.id !== deletePerfilId))
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

  const perfilByName = (name: string) => perfis.find(p => p.nome === name)

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
                {users.map(u => {
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
                          <button className="btn btn-ghost btn-icon btn-sm" title="Excluir" style={{ color: '#f87171' }} onClick={() => setDeleteUserId(u.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── ALUNOS & RESPONSÁVEIS ── */}
      {tab === 'alunos' && <AuthAlunosTab />}
      {tab === 'responsaveis' && <AuthResponsaveisTab />}

      {/* ── PERFIS & PERMISSÕES ── */}
      {tab === 'perfis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={openAddPerfil}><Plus size={13} />Novo Perfil</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {perfis.map(p => (
              <div key={p.id} className="card" style={{ padding: '20px', borderTop: `3px solid ${p.cor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${p.cor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={16} color={p.cor} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {users.filter(u => u.perfil === p.nome).length + (p.nome === 'Família' ? totalFamiliaUsuarios : 0)} usuário(s)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditPerfil(p)}><Pencil size={11} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setDeletePerfilId(p.id)}><Trash2 size={11} /></button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginBottom: 10 }}>{p.descricao}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {p.permissoes.map(mod => (
                    <span key={mod} style={{ fontSize: 10, padding: '2px 6px', background: `${p.cor}18`, color: p.cor, borderRadius: 4, border: `1px solid ${p.cor}30`, fontWeight: 600 }}>{mod}</span>
                  ))}
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
            <button className="btn btn-ghost" onClick={() => setUserModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveUser}><Save size={13} />{userModal === 'add' ? 'Inserir Usuário' : 'Salvar alterações'}</button>
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
              <label className="form-label">Permissões por Módulo e Página</label>
              {!isDiretorGeral && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, marginBottom: 10, fontSize: 12, color: '#fbbf24' }}>
                  <Lock size={12} /> Apenas o Diretor Geral pode editar permissões de módulo.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {MODULES_CONFIG.map(mod => {
                  const allKeys = [mod.key, ...mod.pages.map(p => p.key)]
                  const allChecked = allKeys.every(k => perfilForm.permissoes.includes(k))
                  const someChecked = allKeys.some(k => perfilForm.permissoes.includes(k)) && !allChecked
                  const checkedCount = allKeys.filter(k => perfilForm.permissoes.includes(k)).length
                  const isExpanded = expandedModulos.includes(mod.key)
                  const toggleExpand = () => setExpandedModulos(p => p.includes(mod.key) ? p.filter(k => k !== mod.key) : [...p, mod.key])
                  return (
                    <div key={mod.key} style={{
                      border: `1px solid ${allChecked ? perfilForm.cor + '50' : someChecked ? perfilForm.cor + '30' : 'hsl(var(--border-subtle))'}`,
                      borderRadius: 10,
                      background: allChecked ? `${perfilForm.cor}08` : someChecked ? `${perfilForm.cor}04` : 'hsl(var(--bg-elevated))'
                    }}>
                      {/* Header do módulo — toda a linha é clicável para expandir */}
                      <div
                        onClick={toggleExpand}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        {/* Checkbox do módulo (não propaga o click para o expand) */}
                        <div onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={el => { if (el) el.indeterminate = someChecked }}
                            onChange={() => isDiretorGeral && toggleModulo(mod)}
                            disabled={!isDiretorGeral}
                            style={{ width: 15, height: 15, accentColor: perfilForm.cor, cursor: isDiretorGeral ? 'pointer' : 'not-allowed' }}
                          />
                        </div>
                        {/* Ícone */}
                        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{mod.icon}</span>
                        {/* Nome do módulo */}
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: allChecked ? perfilForm.cor : 'hsl(var(--text-primary))' }}>{mod.label}</span>
                        {/* Contador páginas */}
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 20,
                          background: checkedCount > 0 ? `${perfilForm.cor}18` : 'hsl(var(--bg-overlay))',
                          color: checkedCount > 0 ? perfilForm.cor : 'hsl(var(--text-muted))'
                        }}>{checkedCount}/{allKeys.length}</span>
                        {/* Chevron */}
                        <span style={{ color: 'hsl(var(--text-muted))', flexShrink: 0, display: 'flex' }}>
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                      </div>

                      {/* Sub-páginas — visíveis quando expandido */}
                      {isExpanded && mod.pages.length > 0 && (
                        <div style={{
                          borderTop: `1px solid ${perfilForm.cor}20`,
                          padding: '10px 14px 12px',
                          background: 'hsl(var(--bg-base))',
                          borderRadius: '0 0 9px 9px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '6px 8px'
                        }}>
                          {mod.pages.map(page => {
                            const isChecked = perfilForm.permissoes.includes(page.key)
                            return (
                              <label
                                key={page.key}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '6px 10px', borderRadius: 7,
                                  cursor: isDiretorGeral ? 'pointer' : 'not-allowed',
                                  fontSize: 12, fontWeight: isChecked ? 600 : 400,
                                  background: isChecked ? `${perfilForm.cor}12` : 'transparent',
                                  border: `1px solid ${isChecked ? perfilForm.cor + '30' : 'transparent'}`,
                                  transition: 'all 0.12s',
                                  color: isChecked ? perfilForm.cor : 'hsl(var(--text-secondary))'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => isDiretorGeral && togglePermissao(page.key)}
                                  disabled={!isDiretorGeral}
                                  style={{ width: 13, height: 13, accentColor: perfilForm.cor, flexShrink: 0 }}
                                />
                                <span style={{ lineHeight: 1.3 }}>{page.label}</span>
                              </label>
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
