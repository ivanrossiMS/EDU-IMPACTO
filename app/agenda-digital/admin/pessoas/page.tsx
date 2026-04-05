'use client'

import { useState } from 'react'
import { useData } from '@/lib/dataContext'
import { Search, Filter, Mail, MessageSquare, MoreHorizontal, User, Smartphone, AlertTriangle, Settings, Edit, Key, Lock, X } from 'lucide-react'
import Link from 'next/link'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export default function ADAdminPessoas() {
  const { alunos, setAlunos, turmas } = useData()
  const { adAlert, adConfirm } = useAgendaDigital()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('todos')
  const [filterTurma, setFilterTurma] = useState('')
  const [filterAno, setFilterAno] = useState('')
  const [editingProfile, setEditingProfile] = useState<any>(null)

  const uniqueTurmas = Array.from(new Set((alunos || []).map(a => a.turma).filter(Boolean)))
  const uniqueAnos = Array.from(new Set((turmas || []).map(t => t.ano).filter(Boolean))).sort()

  // MOCK: Assumindo que alunos vêm do ERP, geramos os mock-stats de engajamento da Agenda Digital
  const getEngajamento = (id: string) => {
    const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    if (hash % 3 === 0) return { label: 'Baixo', color: '#ef4444', pct: 25 }
    if (hash % 2 === 0) return { label: 'Médio', color: '#f59e0b', pct: 60 }
    return { label: 'Alto', color: '#10b981', pct: 95 }
  }

  const filtered = (alunos || []).filter(a => {
    if (search && !a.nome.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTurma && a.turma !== filterTurma) return false
    if (filterAno) {
      const turmaRef = (turmas || []).find(t => t.nome === a.turma)
      if (turmaRef?.ano?.toString() !== filterAno) return false
    }
    
    const engj = getEngajamento(a.id)
    if (filterType === 'baixo' && engj.label !== 'Baixo') return false
    if (filterType === 'alto' && engj.label !== 'Alto') return false
    
    return true
  })

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Pessoas vinculadas</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Gestão de responsáveis e alunos conectados à Agenda Digital.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar por nome ou matrícula..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 260 }} 
            />
          </div>
          {uniqueAnos.length > 0 && (
            <select className="form-input" value={filterAno} onChange={e => setFilterAno(e.target.value)}>
              <option value="">Anos Letivos</option>
              {uniqueAnos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {uniqueTurmas.length > 0 && (
            <select className="form-input" value={filterTurma} onChange={e => setFilterTurma(e.target.value)}>
              <option value="">Todas as Turmas</option>
              {uniqueTurmas.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
            </select>
          )}
          <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="todos">Todos os Níveis</option>
            <option value="alto">Engajamento: Alto</option>
            <option value="baixo">Engajamento: Baixo (Risco)</option>
          </select>
          <button className="btn btn-secondary"><Filter size={16} /> Mais Filtros</button>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          {/* ... */}
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Usuário / Família</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Vínculo ERP</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Dispositivos</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Índice de Leitura</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 15).map(a => {
              const engj = getEngajamento(a.id)
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="avatar" style={{ width: 40, height: 40, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))', fontSize: 16 }}>
                        <User size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.nome}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {a.responsavelFinanceiro && <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, padding: '2px 8px' }}>Financ: {a.responsavelFinanceiro}</span>}
                          {a.responsavelPedagogico && <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#4f46e5', fontSize: 11, padding: '2px 8px' }}>Pedag: {a.responsavelPedagogico}</span>}
                          {a.responsavel && a.responsavel !== a.responsavelFinanceiro && a.responsavel !== a.responsavelPedagogico && (
                             <span className="badge badge-ghost" style={{ fontSize: 11, padding: '2px 8px' }}>Outro: {a.responsavel}</span>
                          )}
                          {!a.responsavel && !a.responsavelFinanceiro && !a.responsavelPedagogico && (
                             <span className="badge badge-ghost text-muted" style={{ fontSize: 11, padding: '2px 8px' }}>Responsável Pendente</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {a.status === 'matriculado' || a.status === 'ativo' ? (
                      <span className="badge badge-success">Sincronizado</span>
                    ) : (
                      <span className="badge badge-ghost text-muted">Inativo</span>
                    )}
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Turma: {a.turma}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--text-secondary))' }}>
                      <Smartphone size={14} /> 2 Logs ativos
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: 'hsl(var(--border-subtle))', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${engj.pct}%`, height: '100%', background: engj.color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: engj.color }}>{engj.label}</span>
                      {engj.label === 'Baixo' && <AlertTriangle size={14} color="#ef4444" />}
                    </div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Link href={`/agenda-digital/admin/conversas?newChatId=${a.id}&newChatName=${encodeURIComponent(a.nome)}`} className="btn btn-ghost btn-sm" title="Mensagem Direta">
                        <MessageSquare size={16} />
                      </Link>
                      <Link 
                        href={`/agenda-digital/admin/pessoas/${a.id}`}
                        className="btn btn-secondary btn-sm" 
                        title="Visitar Perfil do Aluno/Família" 
                        style={{ background: 'hsl(var(--bg-main))', borderColor: 'hsl(var(--border-subtle))', textDecoration: 'none', color: 'inherit' }}
                      >
                        <User size={14} /> Visitar Perfil
                      </Link>
                      <button className="btn btn-ghost btn-sm" title="Gerenciar Senhas e Perfil" onClick={() => setEditingProfile(a)}><Settings size={14} /></button>
                      <button className="btn btn-ghost btn-sm" title="Bloquear Acesso" style={{ color: '#ef4444' }} onClick={() => { adConfirm('Bloquear acesso desta família ao App imediatamente?', 'Bloquear Acesso', () => adAlert('Acesso Suspenso!', 'Ação Realizada')) }}><Lock size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <User size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'hsl(var(--text-main))', marginBottom: 8 }}>Nenhum responsável encontrado</h3>
            <p style={{ maxWidth: 400 }}>Você ainda não conectou o ERP à Agenda Digital ou não populou alunos no sistema principal.</p>
            <p style={{ maxWidth: 400, marginTop: 8 }}><b>Dica:</b> Como este é um app stand-alone, acesse a aba "Alunos" do ERP e crie alguns matrículas para visualizar esta malha rica.</p>
          </div>
        )}

        {filtered.length > 15 && (
           <div style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13, background: 'hsl(var(--bg-surface))', borderTop: '1px solid hsl(var(--border-subtle))' }}>
              Mostrando os primeiros 15 de {filtered.length} usuários.
           </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO DE SENHAS E PERFIL */}
      {editingProfile && (
        <EditProfileModal 
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSave={(newProfile) => {
            setAlunos(prev => prev.map(a => a.id === newProfile.id ? newProfile : a))
            setEditingProfile(newProfile)
            adAlert('Dados da família atualizados com sucesso no ERP!', 'Sucesso')
          }}
        />
      )}
    </div>
  )
}

function EditProfileModal({ profile, onClose, onSave }: { profile: any, onClose: ()=>void, onSave: (p:any)=>void }) {
  const [draft, setDraft] = useState(profile)
  const { adAlert } = useAgendaDigital()

  const handleChange = (field: string, value: string) => {
    setDraft((p: any) => ({ ...p, [field]: value }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', width: 540, maxHeight: '90vh', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>Credenciais Desta Família</h2>
              <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>Restaure senhas ou altere contatos da matrícula.</p>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20}/></button>
        </div>

        <div style={{ padding: 32, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Card do Estudante */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 12 }}>Acesso do Estudante</h4>
              <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, background: '#eff6ff', color: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20}/></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{draft.nome}</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{draft.turma} • Código: {draft.codigo || draft.matricula || draft.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                   <input className="form-input" style={{ flex: 1 }} placeholder="Nova senha (opcional)" value={draft.senhaApp || ''} onChange={e => handleChange('senhaApp', e.target.value)} />
                   <button className="btn btn-secondary btn-sm" onClick={() => onSave(draft)}><Key size={14} style={{marginRight: 6}}/> Salvar Aluno</button>
                </div>
              </div>
            </div>

            {/* Card Pai/Responsáveis */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 12 }}>Acesso dos Responsáveis</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {draft.responsaveis && draft.responsaveis.length > 0 ? (
                  draft.responsaveis.map((resp: any, i: number) => {
                    if (!resp.nome) return null;
                    let badgeColor = 'hsl(var(--text-secondary))'; let badgeBg = ''; let title = 'Responsável Secundário';
                    if (resp.respFinanceiro) { badgeColor = '#10b981'; title = 'Guardião Financeiro' }
                    else if (resp.respPedagogico) { badgeColor = '#4f46e5'; title = 'Guardião Pedagógico' }

                    const hRespChange = (field: string, val: string) => {
                      setDraft((p: any) => ({
                        ...p,
                        responsaveis: p.responsaveis.map((r: any) => r.id === resp.id ? { ...r, [field]: val } : r)
                      }))
                    }

                    return (
                      <div key={resp.id || i} style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{resp.nome}</div>
                            <div style={{ fontSize: 12, color: badgeColor, fontWeight: 600, marginTop: 2 }}>{title}</div>
                          </div>
                          <button className="btn btn-ghost btn-sm" onClick={() => adAlert(`Reset enviado SMS para ${resp.nome}`, 'Reset de Senha')}><Key size={14} style={{marginRight: 6}}/> Reenviar Acesso</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                           <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="E-mail" value={resp.email || ''} onChange={e => hRespChange('email', e.target.value)} />
                           <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Celular" value={resp.celular || ''} onChange={e => hRespChange('celular', e.target.value)} />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <>
                    {/* Fallback Legacy for students without ERP array */}
                    {draft.responsavelFinanceiro && (
                      <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{draft.responsavelFinanceiro}</div>
                            <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 2 }}>Guardião Financeiro</div>
                          </div>
                          <button className="btn btn-ghost btn-sm" onClick={() => adAlert(`Reset enviado SMS para ${draft.responsavelFinanceiro}`, 'Reset de Senha')}><Key size={14} style={{marginRight: 6}}/> Reenviar Acesso</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                           <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="E-mail" value={draft.emailResponsavelFinanceiro || ''} onChange={e => handleChange('emailResponsavelFinanceiro', e.target.value)} />
                           <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Celular" value={draft.telResponsavelFinanceiro || ''} onChange={e => handleChange('telResponsavelFinanceiro', e.target.value)} />
                        </div>
                      </div>
                    )}
                    {(!draft.responsavel && !draft.responsavelFinanceiro && !draft.responsavelPedagogico) && (
                      <div style={{ padding: 16, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12 }}>
                        Nenhum responsável foi configurado no ERP (Portal Acadêmico).
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

        </div>

        <div style={{ padding: '24px 32px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => onSave(draft)}>Concluir e Salvar Alterações</button>
        </div>

      </div>
    </div>
  )
}
