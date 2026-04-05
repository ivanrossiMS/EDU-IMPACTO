'use client'

import { useData } from '@/lib/dataContext'
import { useState, useEffect } from 'react'
import { BookOpen, Users, Settings2, Search, Plus, UserPlus, DownloadCloud, ArrowLeft, X, Trash2, Hexagon, Shield, Briefcase, Check } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import { getInitials } from '@/lib/utils'

type GrupoDigital = {
  id: string;
  nome: string;
  cor: string;
  alunosIds: string[];
  colaboradoresIds: string[];
}

const DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6'];

export default function ADAdminTurmas() {
  const { turmas, alunos, funcionarios } = useData()
  
  const [grupos, setGrupos] = useState<GrupoDigital[]>([])
  const [sysUsers, setSysUsers] = useState<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null)
  
  // Modals & Panels
  const [showNovoGrupo, setShowNovoGrupo] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(DEFAULT_COLORS[0])
  
  // Detalhe Views
  const [showImportar, setShowImportar] = useState(false)
  const [buscaAluno, setBuscaAluno] = useState('')
  const [buscaColab, setBuscaColab] = useState('')
  const [tabDetalhe, setTabDetalhe] = useState<'alunos' | 'colaboradores' | 'grupos'>('alunos')

  // Listeners de persistencia
  useEffect(() => {
    const saved = localStorage.getItem('ad_grupos_manuais')
    if (saved) {
      try { setGrupos(JSON.parse(saved)) } catch(e){}
    }
    const sysU = localStorage.getItem('edu-sys-users')
    if (sysU) {
      try { setSysUsers(JSON.parse(sysU)) } catch(e){}
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('ad_grupos_manuais', JSON.stringify(grupos))
    }
  }, [grupos, isLoaded])

  const activeGrupo = grupos.find(g => g.id === activeGrupoId)

  // Criar grupo
  const criarGrupo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) return
    const novo: GrupoDigital = {
      id: `grupo-${Date.now()}`,
      nome: novoNome.trim(),
      cor: novaCor,
      alunosIds: [],
      colaboradoresIds: []
    }
    setGrupos(prev => [novo, ...prev])
    setShowNovoGrupo(false)
    setNovoNome('')
    setNovaCor(DEFAULT_COLORS[0])
  }

  // Deletar grupo
  const handleDeleteGrupo = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esse grupo digital? Ele será sumariamente removido da Agenda para todos os pais.')) {
      setGrupos(prev => prev.filter(g => g.id !== id))
      setActiveGrupoId(null)
    }
  }

  // Injetor Acadêmico (Importar turma)
  const importarTurmaNoGrupo = (turmaNome: string) => {
    if (!activeGrupo) return
    const alunosDaTurma = (alunos || []).filter(a => a.turma === turmaNome).map(a => a.id)
    
    // Merge sem duplicar
    const newAlunosIds = Array.from(new Set([...activeGrupo.alunosIds, ...alunosDaTurma]))
    
    setGrupos(prev => prev.map(g => g.id === activeGrupo.id ? { ...g, alunosIds: newAlunosIds } : g))
    setShowImportar(false)
  }

  // Adicionar Manual
  const adicionarAluno = (id: string) => {
    if (!activeGrupo) return
    if (!activeGrupo.alunosIds.includes(id)) {
      setGrupos(prev => prev.map(g => g.id === activeGrupo.id ? { ...g, alunosIds: [...g.alunosIds, id] } : g))
    }
    setBuscaAluno('')
  }
  const removerAluno = (id: string) => {
    setGrupos(prev => prev.map(g => g.id === activeGrupo?.id ? { ...g, alunosIds: g.alunosIds.filter(aid => aid !== id) } : g))
  }

  const adicionarColaborador = (id: string) => {
    if (!activeGrupo) return
    if (!activeGrupo.colaboradoresIds.includes(id)) {
      setGrupos(prev => prev.map(g => g.id === activeGrupo.id ? { ...g, colaboradoresIds: [...g.colaboradoresIds, id] } : g))
    }
    setBuscaColab('')
  }
  const removerColab = (id: string) => {
    setGrupos(prev => prev.map(g => g.id === activeGrupo?.id ? { ...g, colaboradoresIds: g.colaboradoresIds.filter(cid => cid !== id) } : g))
  }

  const mesclarGrupo = (outroGrupoId: string) => {
    if (!activeGrupo) return
    const outro = grupos.find(g => g.id === outroGrupoId)
    if (!outro) return
    const currentAlunos = activeGrupo.alunosIds || []
    const currentColabs = activeGrupo.colaboradoresIds || []
    const outroAlunos = outro.alunosIds || []
    const outroColabs = outro.colaboradoresIds || []
    
    if(confirm(`Tem certeza que deseja copiar os ${outroAlunos.length} alunos e ${outroColabs.length} gestores do grupo "${outro.nome}" para dentro de "${activeGrupo.nome}"?`)) {
       const newAlunos = Array.from(new Set([...currentAlunos, ...outroAlunos]))
       const newCols = Array.from(new Set([...currentColabs, ...outroColabs]))
       setGrupos(prev => prev.map(g => g.id === activeGrupo.id ? { ...g, alunosIds: newAlunos, colaboradoresIds: newCols } : g))
       setTabDetalhe('alunos')
    }
  }

  // Mocks de Filtros Pós-Busca Dinâmica
  const searchResultsAlunos = buscaAluno.length > 2 ? (alunos || []).filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())).slice(0, 5) : []
  const searchResultsColabs = (sysUsers || []).filter(u => u.nome.toLowerCase().includes(buscaColab.toLowerCase()))


  // 1. TELA MAIN (LISTAGEM DE GRUPOS)
  if (!activeGrupoId) {
    return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Grupos de Comunicação</h2>
            <p style={{ color: 'hsl(var(--text-muted))', fontSize: 15, marginTop: 4 }}>Crie salas digitais flexíveis e importe membros do acadêmico.</p>
          </div>
          
          <button onClick={() => setShowNovoGrupo(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 24, boxShadow: '0 8px 24px rgba(99,102,241,0.2)' }}>
            <Plus size={20} /> Novo Grupo Digital
          </button>
        </div>

        {grupos.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--bg-surface))', borderRadius: 24, border: '1px dashed hsl(var(--border-subtle))' }}>
            <Hexagon size={64} style={{ color: 'hsl(var(--primary))', opacity: 0.2, marginBottom: 24 }} />
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 8 }}>Seu mural está vazio</h3>
            <p style={{ color: 'hsl(var(--text-muted))', maxWidth: 400, textAlign: 'center', marginBottom: 24 }}>Inicie criando um grupo customizado para acomodar alunos e coordenar publicações exclusivas e pontuais.</p>
            <button onClick={() => setShowNovoGrupo(true)} className="btn btn-secondary">Configurar Primeiro Grupo</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {grupos.map(g => (
              <div 
                key={g.id} 
                onClick={() => setActiveGrupoId(g.id)}
                style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 24, cursor: 'pointer', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = g.cor; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 6, background: g.cor }} />
                
                <h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 8, marginBottom: 16 }}>{g.nome}</h3>
                
                <div style={{ display: 'flex', gap: 24, padding: '16px 0', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 16 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={16} /></div>
                     <div>
                       <div style={{ fontSize: 16, fontWeight: 700 }}>{g.alunosIds.length}</div>
                       <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Membros</div>
                     </div>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(236,72,153,0.1)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Briefcase size={16} /></div>
                     <div>
                       <div style={{ fontSize: 16, fontWeight: 700 }}>{g.colaboradoresIds.length}</div>
                       <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Equipe</div>
                     </div>
                   </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'hsl(var(--text-muted))', fontSize: 13, fontWeight: 600 }}>
                  <span>Aberta para Publicações</span>
                  <span style={{ color: g.cor }}>Gerenciar &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Novo Grupo */}
        {showNovoGrupo && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, width: 440, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.1)' }}>
               <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Criar Grupo Digital</h3>
               <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginBottom: 24 }}>Você está isolando um canal exclusivo para conectar pais e professores.</p>
               
               <form onSubmit={criarGrupo} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                 <div>
                   <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Nome do Grupo de Transmissão</label>
                   <input className="form-input" placeholder="Ex: Comunicações - Nível Medio" autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)} required />
                 </div>

                 <div>
                   <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tema e Capa (Cor de destaque)</label>
                   <div style={{ display: 'flex', gap: 12 }}>
                     {DEFAULT_COLORS.map(c => (
                       <div key={c} onClick={() => setNovaCor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, cursor: 'pointer', border: novaCor === c ? '3px solid hsl(var(--bg-main))' : 'none', outline: novaCor === c ? `2px solid ${c}` : 'none', transition: 'all 0.1s' }} />
                     ))}
                   </div>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                   <button type="button" onClick={() => setShowNovoGrupo(false)} className="btn btn-secondary">Cancelar</button>
                   <button type="submit" className="btn btn-primary" style={{ background: novaCor, borderColor: novaCor }}>Lançar Grupo</button>
                 </div>
               </form>
             </div>
          </div>
        )}
      </div>
    )
  }

  // 2. TELA DETALHE DO GRUPO (activeGrupoId != null)
  if (!activeGrupo) return null

  // Resolve as listas do BD
  const alunosVinculados = (alunos || []).filter(a => activeGrupo.alunosIds.includes(a.id))
  const colsVinculados = (sysUsers || []).filter(u => activeGrupo.colaboradoresIds.includes(u.id))
  const turmasUnicasERP = Array.from(new Set((turmas || []).map(t => t.nome)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <button onClick={() => setActiveGrupoId(null)} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: activeGrupo.cor }} />
                <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{activeGrupo.nome}</h2>
              </div>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>{activeGrupo.alunosIds.length} alunos inscritos neste mural digital.</p>
            </div>
          </div>
          
          <button onClick={() => handleDeleteGrupo(activeGrupo.id)} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={16} /> Excluir Grupo Geral
          </button>
       </div>

       <div style={{ flex: 1, background: 'hsl(var(--bg-surface))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', display: 'flex', overflow: 'hidden' }}>
          
          {/* Menu Lateral de Tabs */}
          <div style={{ width: 260, borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.01)' }}>
            <button onClick={() => setTabDetalhe('alunos')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: 'none', borderLeft: tabDetalhe === 'alunos' ? `4px solid ${activeGrupo.cor}` : '4px solid transparent', background: tabDetalhe === 'alunos' ? `${activeGrupo.cor}12` : 'transparent', color: tabDetalhe === 'alunos' ? activeGrupo.cor : 'hsl(var(--text-muted))', fontWeight: tabDetalhe === 'alunos' ? 700 : 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s' }}>
               <Users size={18} /> Alunos Relacionados
            </button>
            <button onClick={() => setTabDetalhe('colaboradores')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: 'none', borderLeft: tabDetalhe === 'colaboradores' ? `4px solid ${activeGrupo.cor}` : '4px solid transparent', background: tabDetalhe === 'colaboradores' ? `${activeGrupo.cor}12` : 'transparent', color: tabDetalhe === 'colaboradores' ? activeGrupo.cor : 'hsl(var(--text-muted))', fontWeight: tabDetalhe === 'colaboradores' ? 700 : 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s' }}>
               <Shield size={18} /> Equipe
            </button>
            <button onClick={() => setTabDetalhe('grupos')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: 'none', borderLeft: tabDetalhe === 'grupos' ? `4px solid ${activeGrupo.cor}` : '4px solid transparent', background: tabDetalhe === 'grupos' ? `${activeGrupo.cor}12` : 'transparent', color: tabDetalhe === 'grupos' ? activeGrupo.cor : 'hsl(var(--text-muted))', fontWeight: tabDetalhe === 'grupos' ? 700 : 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s' }}>
               <Hexagon size={18} /> Adicionar Grupos
            </button>
          </div>

          {/* Painel Interno da Aba */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-main))' }}>
              {/* Header do Painel de Aba */}
              <div style={{ padding: 32, borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 800 }}>{tabDetalhe === 'alunos' ? 'Alunos Participantes' : tabDetalhe === 'colaboradores' ? 'Acessos Administrativos' : 'Mesclar Grupos Digitais'}</h3>
                    <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>
                      {tabDetalhe === 'alunos' ? 'Gerencie as famílias que receberão mensagens deste canal.' : tabDetalhe === 'colaboradores' ? 'Quem são os funcionários que possuem privilégio de envio aqui?' : 'Selecione abaixo outro grupo para copiar todos os seus membros para cá.'}
                    </p>
                  </div>
                  
                  {tabDetalhe === 'alunos' && (
                    <button onClick={() => setShowImportar(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, background: activeGrupo.cor, borderColor: activeGrupo.cor }}>
                      <DownloadCloud size={16} /> Puxar Turma Acadêmica
                    </button>
                  )}
              </div>

              {/* Area de Busca do BD (Avulsa) */}
              {tabDetalhe !== 'grupos' && (
                <div style={{ padding: '24px 32px', background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid hsl(var(--border-subtle))', position: 'relative' }}>
                   <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
                     <Search size={16} style={{ position: 'absolute', left: 16, top: 12, color: 'hsl(var(--text-muted))' }} />
                     <input 
                       className="form-input" 
                       placeholder={tabDetalhe === 'alunos' ? 'Buscar e matricular aluno extra (ex: Carlos)...' : 'Buscar por nome do coordenador/professor avulso...'}
                       value={tabDetalhe === 'alunos' ? buscaAluno : buscaColab}
                       onChange={e => tabDetalhe === 'alunos' ? setBuscaAluno(e.target.value) : setBuscaColab(e.target.value)}
                       style={{ paddingLeft: 42, width: '100%', borderRadius: 12, border: '2px solid hsl(var(--border-subtle))' }}
                     />
                   </div>

                 {/* Dropdown in-flow natural */}
                 {tabDetalhe === 'alunos' && searchResultsAlunos.length > 0 && (
                   <div style={{ marginTop: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, zIndex: 10, overflow: 'hidden' }}>
                      {searchResultsAlunos.map(a => (
                        <div key={a.id} onClick={() => adicionarAluno(a.id)} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='hsl(var(--bg-main))'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Turma: {a.turma}</div>
                          </div>
                          {activeGrupo.alunosIds.includes(a.id) ? <span style={{fontSize: 12, color: '#10b981', fontWeight: 600}}>Adicionado</span> : <span style={{fontSize: 20, color: 'hsl(var(--primary))'}}>+</span>}
                        </div>
                      ))}
                   </div>
                 )}

                 {tabDetalhe === 'colaboradores' && searchResultsColabs.length > 0 && (
                   <div style={{ marginTop: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, zIndex: 10, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                      {searchResultsColabs.map(f => (
                        <div key={f.id} onClick={() => adicionarColaborador(f.id)} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='hsl(var(--bg-main))'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</div>
                            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{f.perfil || 'Gestor'}</div>
                          </div>
                          {activeGrupo.colaboradoresIds.includes(f.id) ? <span style={{fontSize: 12, color: '#10b981', fontWeight: 600}}>Gestor</span> : <span style={{fontSize: 20, color: 'hsl(var(--primary))'}}>+</span>}
                        </div>
                      ))}
                   </div>
                 )}
                </div>
              )}

              {/* Lista dos Incorporados na Aba (Alunos/Gestores) */}
              {tabDetalhe !== 'grupos' && (
                <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
                   {(tabDetalhe === 'alunos' ? alunosVinculados : colsVinculados).map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'hsl(var(--bg-surface))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                       <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                         {tabDetalhe === 'alunos' ? (
                           <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                             {getInitials(item.nome)}
                           </div>
                         ) : (
                           <UserAvatar userId={item.id} name={item.nome} size={40} />
                         )}
                         <div>
                           <div style={{ fontWeight: 700, fontSize: 15 }}>{item.nome}</div>
                           <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                             {tabDetalhe === 'alunos' ? `Matriculado no ERP: ${item.turma}` : `Perfil de Acesso: ${item.perfil || 'Administrativo'}`}
                           </div>
                         </div>
                       </div>
                       <button onClick={() => tabDetalhe === 'alunos' ? removerAluno(item.id) : removerColab(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', outline: 'none', cursor: 'pointer', padding: 8, opacity: 0.8 }} title="Retirar do grupo"><X size={18} /></button>
                    </div>
                 ))}

                 {(tabDetalhe === 'alunos' ? alunosVinculados : colsVinculados).length === 0 && (
                   <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: 40 }}>
                     <Users size={32} style={{ opacity: 0.2, marginBottom: 16 }} />
                     <div>Nenhum {tabDetalhe === 'alunos' ? 'aluno membro' : 'administrador inserido'} nesta sala digital.</div>
                     <div style={{ fontSize: 13, marginTop: 4 }}>Busque pelo nome na caixa logo acima para vincular.</div>
                   </div>
                 )}
                </div>
              )}

              {/* Area de Busca e Listagem para GRUPOS */}
              {tabDetalhe === 'grupos' && (
                <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                     {grupos.filter(g => g.id !== activeGrupo.id).map(g => (
                       <div key={g.id} onClick={() => mesclarGrupo(g.id)} style={{ padding: '20px', background: 'hsl(var(--bg-surface))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }} onMouseEnter={e => { e.currentTarget.style.borderColor = activeGrupo.cor }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
                         <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: g.cor }} />
                         <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{g.nome}</div>
                         <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                           Copiar {g.alunosIds?.length || 0} alunos e {g.colaboradoresIds?.length || 0} gestores
                         </div>
                         <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: activeGrupo.cor }}>
                           <Plus size={14} /> Incorporar Membros
                         </div>
                       </div>
                     ))}
                     {grupos.filter(g => g.id !== activeGrupo.id).length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'hsl(var(--text-muted))', padding: 40 }}>
                          <Hexagon size={32} style={{ opacity: 0.2, marginBottom: 16 }} />
                          <div>Nenhum outro grupo disponível.</div>
                          <div style={{ fontSize: 13, marginTop: 4 }}>Crie novos grupos no painel principal anterior.</div>
                        </div>
                     )}
                  </div>
                </div>
              )}
          </div>
       </div>

       {/* MODAL: Importar Turma Magica ERP */}
       {showImportar && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, width: 440, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><DownloadCloud size={20} color={activeGrupo.cor} /> Importar Matriculados</h3>
                <button onClick={() => setShowImportar(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20}/></button>
              </div>
              
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginBottom: 24 }}>Selecione uma turma acadêmica (ERP) oficial. Todos os alunos inscritos nela farão parte desta sala digital instantaneamente.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                {turmasUnicasERP.map(tNome => {
                  const numAlunos = (alunos || []).filter(a => a.turma === tNome).length;
                  return (
                    <div key={tNome} onClick={() => importarTurmaNoGrupo(tNome)} style={{ padding: '16px', background: 'hsl(var(--bg-surface))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.borderColor=activeGrupo.cor} onMouseLeave={e => e.currentTarget.style.borderColor='hsl(var(--border-subtle))'}>
                       <div>
                         <div style={{ fontWeight: 700 }}>{tNome}</div>
                         <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{numAlunos} alunos no cadastro</div>
                       </div>
                       <UserPlus size={18} color="hsl(var(--primary))"/>
                    </div>
                  )
                })}
              </div>
            </div>
         </div>
       )}

    </div>
  )
}

