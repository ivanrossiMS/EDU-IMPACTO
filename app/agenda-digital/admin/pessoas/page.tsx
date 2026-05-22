'use client'
import { useSupabaseArray, invalidateCache } from '@/lib/useSupabaseCollection';

import { useState, useEffect, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import { Search, Filter, Mail, MessageSquare, User, Smartphone, AlertTriangle, Settings, Key, Lock, X, CheckCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { UserAvatar } from '@/components/UserAvatar'

export default function ADAdminPessoas() {
  const { turmas = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const { adAlert, adConfirm } = useAgendaDigital()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('todos')
  const [filterTurma, setFilterTurma] = useState('')
  const [filterAno, setFilterAno] = useState('')
  const [editingProfile, setEditingProfile] = useState<any>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [responsaveisMap, setResponsaveisMap] = useState<Record<string, any[]>>({})

  // Force fresh data every time this page is opened (bust the stale cache)
  useEffect(() => {
    invalidateCache('alunos')
  }, [])

  // Reset pagination to first page when any filters or search queries change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterType, filterTurma, filterAno, pageSize])

  // Busca responsaveis via API publica (servico com service_role, sem restricao de RLS)
  const handleOpenProfile = useCallback(async (aluno: any) => {
    setLoadingProfile(true)
    try {
      const alunoId = aluno.id || aluno.matricula || aluno.dados?.codigo
      const res = await fetch(`/api/aluno-responsavel?aluno_id=${encodeURIComponent(alunoId)}`)
      const data = await res.json()
      setEditingProfile({ ...aluno, responsaveis: data.responsaveis || [] })
    } catch (err) {
      console.error('Erro ao buscar responsaveis:', err)
      setEditingProfile(aluno)
    } finally {
      setLoadingProfile(false)
    }
  }, [])

  const uniqueTurmas = Array.from(new Set((alunos || []).map(a => a.turma).filter(Boolean)))
  const uniqueAnos = Array.from(new Set((turmas || []).map(t => t.ano).filter(Boolean))).sort()

  const getEngajamento = (id: string) => {
    const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    if (hash % 3 === 0) return { label: 'Baixo', color: '#ef4444', pct: 25 }
    if (hash % 2 === 0) return { label: 'Medio', color: '#f59e0b', pct: 60 }
    return { label: 'Alto', color: '#10b981', pct: 95 }
  }

  const filtered = (alunos || []).filter(a => {
    if (!a.nome || a.nome.trim() === '') return false
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

  const totalPages = Math.ceil(filtered.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filtered.length)
  const paginatedAlunos = filtered.slice(startIndex, endIndex)

  // Fetch responsaveis in bulk for the current paginated view
  useEffect(() => {
    async function fetchResponsaveisForPage() {
      if (!paginatedAlunos || paginatedAlunos.length === 0) return
      
      // Get IDs for current page
      const idsToFetch = paginatedAlunos
        .map(a => a.id || a.matricula || a.dados?.codigo)
        .filter(Boolean)
        
      if (idsToFetch.length === 0) return
      
      try {
        const res = await fetch(`/api/aluno-responsavel?aluno_ids=${encodeURIComponent(idsToFetch.join(','))}`)
        if (res.ok) {
          const data = await res.json()
          if (data.responsaveisMap) {
            setResponsaveisMap(prev => ({ ...prev, ...data.responsaveisMap }))
          }
        }
      } catch (err) {
        console.error('Erro ao buscar responsaveis em lote:', err)
      }
    }
    
    // We only want to run this when the set of paginated students changes.
    // The easiest is to trigger when the derived paginated list changes its IDs.
    const idsHash = paginatedAlunos.map(a => a.id).join(',')
    if (idsHash) {
      fetchResponsaveisForPage()
    }
  }, [currentPage, pageSize, search, filterType, filterTurma, filterAno, alunos]) // Depend on all variables that affect paginatedAlunos

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Pessoas vinculadas</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Gestao de responsaveis e alunos conectados a Agenda Digital.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" placeholder="Buscar por nome ou matricula..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: 260 }} />
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
              {uniqueTurmas.map(t => {
                const tName = turmas.find((tt: any) => tt.id === t)?.nome || t;
                return <option key={t as string} value={t as string}>{tName}</option>
              })}
            </select>
          )}
          <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="todos">Todos os Niveis</option>
            <option value="alto">Engajamento: Alto</option>
            <option value="baixo">Engajamento: Baixo (Risco)</option>
          </select>
          <button className="btn btn-secondary"><Filter size={16} /> Mais Filtros</button>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Usuario / Familia</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Vinculo ERP</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Dispositivos</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Indice de Leitura</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAlunos.map(a => {
              const engj = getEngajamento(a.id)
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: a.bloqueadoAgenda ? 'rgba(239, 68, 68, 0.05)' : '' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <UserAvatar userId={a.id} name={a.nome} fotoUrl={a.foto} size={54} />
                      <div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.nome}
                          {a.bloqueadoAgenda && <span className="badge" style={{ background: '#ef4444', color: 'white', fontSize: 10, padding: '2px 6px' }}>BLOQUEADO</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {(() => {
                            const resps = responsaveisMap[a.id] || a.responsaveis
                            if (resps && resps.length > 0) {
                              return resps.map((r: any, i: number) => {
                              if (!r.nome) return null;
                              let badgeStyle = { background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))' };
                              let label = 'Resp: ';
                              const isFin = r.respFinanceiro || r.isFinanceiro;
                              const isPed = r.respPedagogico || r.isPedagogico;
                              if (isFin && isPed) { badgeStyle = { background: 'rgba(236,72,153,0.1)', color: '#ec4899' }; label = 'Fin/Pedag: '; }
                              else if (isFin) { badgeStyle = { background: 'rgba(16,185,129,0.1)', color: '#10b981' }; label = 'Financ: '; }
                              else if (isPed) { badgeStyle = { background: 'rgba(99,102,241,0.1)', color: '#4f46e5' }; label = 'Pedag: '; }
                                return <span key={i} className="badge" style={{ ...badgeStyle, fontSize: 11, padding: '2px 8px' }}>{label}{r.nome}</span>
                              })
                            } else {
                              return (
                                <>
                                  {a.responsavelFinanceiro && <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, padding: '2px 8px' }}>Financ: {a.responsavelFinanceiro}</span>}
                                  {a.responsavelPedagogico && <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#4f46e5', fontSize: 11, padding: '2px 8px' }}>Pedag: {a.responsavelPedagogico}</span>}
                                  {a.responsavel && a.responsavel !== a.responsavelFinanceiro && a.responsavel !== a.responsavelPedagogico && (
                                    <span className="badge badge-ghost" style={{ fontSize: 11, padding: '2px 8px' }}>Outro: {a.responsavel}</span>
                                  )}
                                  {!a.responsavel && !a.responsavelFinanceiro && !a.responsavelPedagogico && (
                                    <span className="badge badge-ghost text-muted" style={{ fontSize: 11, padding: '2px 8px' }}>Responsavel Pendente</span>
                                  )}
                                </>
                              )
                            }
                          })()}
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
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Turma: {turmas.find((t: any) => t.id === a.turma)?.nome || a.turma}</div>
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
                      <Link href={`/agenda-digital/admin/pessoas/${a.id}`} className="btn btn-secondary btn-sm" title="Visitar Perfil do Aluno/Familia" style={{ background: 'hsl(var(--bg-main))', borderColor: 'hsl(var(--border-subtle))', textDecoration: 'none', color: 'inherit' }}>
                        <User size={14} /> Visitar Perfil
                      </Link>
                      <button className="btn btn-ghost btn-sm" title="Gerenciar Senhas e Perfil" onClick={() => handleOpenProfile(a)} disabled={loadingProfile}>
                        {loadingProfile ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Settings size={14} />}
                      </button>
                      <button className="btn btn-ghost btn-sm" title={a.bloqueadoAgenda ? "Desbloquear Acesso" : "Bloquear Acesso"} style={{ color: a.bloqueadoAgenda ? '#10b981' : '#ef4444' }}
                        onClick={() => {
                          const action = a.bloqueadoAgenda ? 'Desbloquear' : 'Bloquear';
                          adConfirm(`${action} acesso desta familia ao App imediatamente?`, `${action} Acesso`, () => {
                            setAlunos((prev: any) => prev.map((al: any) => al.id === a.id ? { ...al, bloqueadoAgenda: !al.bloqueadoAgenda } : al));
                            adAlert(a.bloqueadoAgenda ? 'Acesso Liberado!' : 'Acesso Suspenso!', 'Acao Realizada');
                          });
                        }}
                      >
                        {a.bloqueadoAgenda ? <CheckCircle size={14} /> : <Lock size={14} />}
                      </button>
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
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'hsl(var(--text-main))', marginBottom: 8 }}>Nenhum responsavel encontrado</h3>
            <p style={{ maxWidth: 400 }}>Voce ainda nao conectou o ERP a Agenda Digital ou nao populou alunos no sistema principal.</p>
          </div>
        )}

        <div style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'hsl(var(--bg-surface))',
          borderTop: '1px solid hsl(var(--border-subtle))',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
            <span>Mostrar</span>
            <select
              className="form-input"
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              style={{ width: 75, padding: '4px 8px', height: 'auto' }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>por página</span>
            <span style={{ marginLeft: 12 }}>
              {filtered.length > 0 ? `${startIndex + 1} - ${endIndex} de ${filtered.length} alunos` : '0 de 0 alunos'}
            </span>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  const isNear = Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages;
                  if (!isNear) {
                    if (p === 2 || p === totalPages - 1) {
                      return <span key={p} style={{ color: 'hsl(var(--text-muted))', padding: '0 4px' }}>...</span>;
                    }
                    return null;
                  }
                  
                  return (
                    <button
                      key={p}
                      className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCurrentPage(p)}
                      style={{
                        minWidth: 32,
                        padding: '6px 8px',
                        background: currentPage === p ? 'hsl(var(--primary))' : 'transparent',
                        borderColor: currentPage === p ? 'hsl(var(--primary))' : 'hsl(var(--border-subtle))',
                        color: currentPage === p ? 'white' : 'inherit'
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Próximo <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {editingProfile && (
        <EditProfileModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSave={(newProfile) => {
            setAlunos(prev => prev.map(a => a.id === newProfile.id ? newProfile : a))
            setEditingProfile(newProfile)
            adAlert('Dados da familia atualizados com sucesso no ERP!', 'Sucesso')
          }}
        />
      )}
    </div>
  )
}

function EditProfileModal({ profile, onClose, onSave }: { profile: any, onClose: ()=>void, onSave: (p:any)=>void }) {
  const [draft, setDraft] = useState(profile)
  const [loadingResps, setLoadingResps] = useState(false)
  const { adAlert, adConfirm } = useAgendaDigital()

  // Ao abrir, busca responsaveis frescos via API publica (bypasses RLS e sessao)
  useEffect(() => {
    async function fetchResponsaveis() {
      setLoadingResps(true)
      try {
        const alunoId = profile.id || profile.matricula || profile.dados?.codigo
        const res = await fetch(`/api/aluno-responsavel?aluno_id=${encodeURIComponent(alunoId)}`)
        const data = await res.json()
        if (data.responsaveis && data.responsaveis.length > 0) {
          setDraft((prev: any) => ({ ...prev, responsaveis: data.responsaveis }))
        }
      } catch (err) {
        console.error('Erro ao buscar responsaveis no modal:', err)
      } finally {
        setLoadingResps(false)
      }
    }
    fetchResponsaveis()
  }, [profile.id])

  const handleChange = (field: string, value: string) => setDraft((p: any) => ({ ...p, [field]: value }))

  const handleResetAccess = (type: string, id: string, name: string) => {
    adConfirm(`Reiniciar o acesso de ${name}?`, 'Reiniciar Acesso', async () => {
      try {
        const res = await fetch('/api/auth/reset-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }) })
        const data = await res.json()
        adAlert(res.ok ? (data.message || 'Acesso reiniciado!') : (data.error || 'Erro ao reiniciar.'), res.ok ? 'Sucesso' : 'Erro')
      } catch { adAlert('Falha na comunicacao com o servidor.', 'Erro') }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', width: 540, maxHeight: '90vh', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>Credenciais Desta Familia</h2>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>Restaure senhas ou altere contatos da matricula.</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20}/></button>
        </div>

        <div style={{ padding: 32, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 12 }}>Acesso do Estudante</h4>
            <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, background: '#eff6ff', color: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20}/></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{draft.nome}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{draft.turma} - Codigo: {draft.codigo || draft.matricula || draft.id}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Nova senha (opcional)" value={draft.senhaApp || ''} onChange={e => handleChange('senhaApp', e.target.value)} />
                <button className="btn btn-secondary btn-sm" onClick={() => onSave(draft)}><Key size={14} style={{marginRight: 6}}/> Salvar Aluno</button>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              Acesso dos Responsaveis
              {loadingResps && <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {loadingResps && (!draft.responsaveis || draft.responsaveis.length === 0) ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12 }}>
                  <Loader size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                  <div>Carregando responsaveis...</div>
                </div>
              ) : draft.responsaveis && draft.responsaveis.length > 0 ? (
                draft.responsaveis.map((resp: any, i: number) => {
                  if (!resp.nome) return null;
                  let badgeColor = 'hsl(var(--text-secondary))'; let title = 'Responsavel Secundario';
                  const isFin = resp.respFinanceiro || resp.isFinanceiro;
                  const isPed = resp.respPedagogico || resp.isPedagogico;
                  if (isFin && isPed) { badgeColor = '#ec4899'; title = 'Guardiao Financeiro e Pedagogico' }
                  else if (isFin) { badgeColor = '#10b981'; title = 'Guardiao Financeiro' }
                  else if (isPed) { badgeColor = '#4f46e5'; title = 'Guardiao Pedagogico' }

                  const hRespChange = (field: string, val: any) => {
                    setDraft((p: any) => ({ ...p, responsaveis: p.responsaveis.map((r: any) => r.id === resp.id ? { ...r, [field]: val } : r) }))
                  }

                  return (
                    <div key={resp.id || i} style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{resp.nome}</div>
                          <div style={{ fontSize: 12, color: badgeColor, fontWeight: 600, marginTop: 2 }}>{title}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleResetAccess('responsavel', resp.id, resp.nome)}><Key size={14} style={{marginRight: 6}}/> Reiniciar Acesso</button>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!isFin} onChange={e => { hRespChange('respFinanceiro', e.target.checked); hRespChange('isFinanceiro', e.target.checked); }} />
                          Financeiro
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!isPed} onChange={e => { hRespChange('respPedagogico', e.target.checked); hRespChange('isPedagogico', e.target.checked); }} />
                          Pedagogico
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="E-mail" value={resp.email || ''} onChange={e => hRespChange('email', e.target.value)} />
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Celular" value={resp.celular || resp.telefone || ''} onChange={e => hRespChange('celular', e.target.value)} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <>
                  {draft.responsavelFinanceiro && (
                    <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{draft.responsavelFinanceiro}</div>
                          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 2 }}>Guardiao Financeiro</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => adAlert('Responsaveis legados devem ser reiniciados via aba Usuarios.', 'Aviso')}><Key size={14} style={{marginRight: 6}}/> Reiniciar Acesso</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="E-mail" value={draft.emailResponsavelFinanceiro || ''} onChange={e => handleChange('emailResponsavelFinanceiro', e.target.value)} />
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Celular" value={draft.telResponsavelFinanceiro || ''} onChange={e => handleChange('telResponsavelFinanceiro', e.target.value)} />
                      </div>
                    </div>
                  )}
                  {draft.responsavelPedagogico && (
                    <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{draft.responsavelPedagogico}</div>
                          <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600, marginTop: 2 }}>Guardiao Pedagogico</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => adAlert('Responsaveis legados devem ser reiniciados via aba Usuarios.', 'Aviso')}><Key size={14} style={{marginRight: 6}}/> Reiniciar Acesso</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="E-mail" value={draft.emailResponsavelPedagogico || ''} onChange={e => handleChange('emailResponsavelPedagogico', e.target.value)} />
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Celular" value={draft.telResponsavelPedagogico || ''} onChange={e => handleChange('telResponsavelPedagogico', e.target.value)} />
                      </div>
                    </div>
                  )}
                  {draft.responsavel && draft.responsavel !== draft.responsavelFinanceiro && draft.responsavel !== draft.responsavelPedagogico && (
                    <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{draft.responsavel}</div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600, marginTop: 2 }}>Responsavel Legado</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => adAlert('Responsaveis legados devem ser reiniciados via aba Usuarios.', 'Aviso')}><Key size={14} style={{marginRight: 6}}/> Reiniciar Acesso</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="E-mail" value={draft.emailResponsavel || ''} onChange={e => handleChange('emailResponsavel', e.target.value)} />
                        <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Celular" value={draft.telResponsavel || ''} onChange={e => handleChange('telResponsavel', e.target.value)} />
                      </div>
                    </div>
                  )}
                  {!draft.responsavel && !draft.responsavelFinanceiro && !draft.responsavelPedagogico && (
                    <div style={{ padding: 16, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12 }}>
                      Nenhum responsavel foi configurado no ERP (Portal Academico).
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

        <div style={{ padding: '24px 32px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(draft)}>Concluir e Salvar Alteracoes</button>
        </div>

      </div>
    </div>
  )
}
