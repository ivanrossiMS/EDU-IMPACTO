'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { motion } from 'framer-motion';

import { useData } from '@/lib/dataContext'
import { useState, useEffect } from 'react'
import { 
  BookOpen, Users, Settings2, Search, Plus, 
  ArrowLeft, X, Trash2, Check, CalendarDays as Calendar,
  MoreHorizontal
} from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

type GrupoDigital = {
  id: string;
  nome: string;
  cor: string;
  alunosIds: string[];
  colaboradoresIds: string[];
}

const DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6'];

export default function ADAdminTurmas() {
  const { turmas = [], cfgCalendarioLetivo = [] } = useData();
  const [alunos] = useSupabaseArray<any>('alunos?limit=9999');
  const [grupos, setGrupos] = useSupabaseArray<GrupoDigital>('agenda/grupos');
  const [funcionarios] = useSupabaseArray<any>('configuracoes/usuarios');
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null)
  const [anoParaImportar, setAnoParaImportar] = useState<string>('')
  const [showNovoGrupo, setShowNovoGrupo] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(DEFAULT_COLORS[0])
  const [tabDetalhe, setTabDetalhe] = useState<'alunos' | 'colaboradores' | 'grupos'>('alunos')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [buscaColab, setBuscaColab] = useState('')

  useEffect(() => {
    if (turmas.length > 0 && (alunos || []).length > 0 && (grupos || []).length >= 0) {
      setIsLoaded(true)
    }
  }, [turmas, alunos, grupos])

  useEffect(() => {
    // Só sincroniza se grupos estiver vazio E alunos já carregaram
    if (isLoaded && (grupos || []).length === 0 && turmas.length > 0 && (alunos || []).length > 0) {
      handleAutoSync()
    }
  }, [isLoaded, (grupos || []).length, turmas.length, (alunos || []).length])

  const handleAutoSync = () => {
    if (!turmas || turmas.length === 0 || !alunos || alunos.length === 0) {
      console.warn('Dados insuficientes para sincronizar:', { turmas: turmas?.length, alunos: alunos?.length });
      return;
    }

    console.log('Iniciando Super-Sincronização Digital...', { totalAlunos: alunos.length, totalTurmas: turmas.length });
    
    const turmasFiltradas = turmas.filter(t => !anoParaImportar || String(t.ano) === String(anoParaImportar))
    const novos: GrupoDigital[] = turmasFiltradas.map(t => {
      // Busca flexível: nome, ID ou Código
      const alunosDaTurma = (alunos || []).filter(a => {
        const aTurma = String(a.turma || '').trim().toLowerCase();
        const tNome = String(t.nome || '').trim().toLowerCase();
        const tId = String(t.id || '').trim().toLowerCase();
        const tCod = String(t.codigo || '').trim().toLowerCase();

        const matchDirect = aTurma === tNome || aTurma === tId || aTurma === tCod || String(a.turmaId || '').trim().toLowerCase() === tId;
        if (matchDirect) return true;

        // Normalização extra (remover acentos, remover espaços extras) para nomes de turmas
        const aTurmaNorm = aTurma.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        const tNomeNorm = tNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        return aTurmaNorm === tNomeNorm && aTurmaNorm !== '';
      });

      // Tenta encontrar o grupo existente para preservar os colaboradores
      const grupoExistente = (grupos || []).find(g => g.id === `sync-${t.id}` || g.nome === t.nome);

      console.log(`Turma [${t.nome}]: ${alunosDaTurma.length} alunos encontrados. Preservando ${grupoExistente?.colaboradoresIds?.length || 0} colaboradores.`);

      return {
        id: grupoExistente?.id || `sync-${t.id}`,
        nome: t.nome,
        cor: grupoExistente?.cor || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
        alunosIds: alunosDaTurma.map(a => a.id),
        colaboradoresIds: grupoExistente?.colaboradoresIds || []
      };
    })

    console.log('Super-Sincronização concluída:', novos);
    setGrupos(novos)
  }

  const activeGrupo = (grupos || []).find(g => g.id === activeGrupoId)

  const criarGrupo = (e: React.FormEvent) => {
    e.preventDefault()
    const novo: GrupoDigital = {
      id: `manual-${Date.now()}`,
      nome: novoNome,
      cor: novaCor,
      alunosIds: [],
      colaboradoresIds: []
    }
    setGrupos([...(grupos || []), novo])
    setNovoNome('')
    setShowNovoGrupo(false)
  }

  const excluirGrupo = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este grupo digital?')) {
      setGrupos((grupos || []).filter(g => g.id !== id))
      setActiveGrupoId(null)
    }
  }

  const adicionarAluno = (id: string) => {
    if (!activeGrupo) return
    if (!(activeGrupo.alunosIds || []).includes(id)) {
      setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, alunosIds: [...(g.alunosIds || []), id] } : g))
    }
    setBuscaAluno('')
  }

  const removerAluno = (id: string) => {
    if (!activeGrupo) return
    setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, alunosIds: (g.alunosIds || []).filter(aid => aid !== id) } : g))
  }

  const adicionarColaborador = (id: string) => {
    if (!activeGrupo) return
    if (!(activeGrupo.colaboradoresIds || []).includes(id)) {
      setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, colaboradoresIds: [...(g.colaboradoresIds || []), id] } : g))
    }
    setBuscaColab('')
  }

  const removerColaborador = (id: string) => {
    if (!activeGrupo) return
    setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, colaboradoresIds: (g.colaboradoresIds || []).filter(cid => cid !== id) } : g))
  }

  const searchResultsAlunos = buscaAluno.length > 2 ? (alunos || []).filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())).slice(0, 5) : []
  const searchResultsColabs = buscaColab.length > 0 ? (funcionarios || []).filter(f => f.nome.toLowerCase().includes(buscaColab.toLowerCase())).slice(0, 10) : []

  if (!isLoaded) return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Carregando turmas...</div>

  // TELA DETALHE DO GRUPO
  if (activeGrupoId && activeGrupo) {
    const alunosVinculados = (alunos || []).filter(a => (activeGrupo.alunosIds || []).includes(a.id))
    const colsVinculados = (funcionarios || []).filter(u => (activeGrupo.colaboradoresIds || []).includes(u.id))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
         <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
               <button onClick={() => setActiveGrupoId(null)} style={{ width: 44, height: 44, borderRadius: 22, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <ArrowLeft size={20} />
               </button>
               <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 6, background: activeGrupo.cor }} />
                    <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase' }}>{activeGrupo.nome}</h2>
                  </div>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>{alunosVinculados.length} alunos inscritos neste mural digital.</p>
               </div>
            </div>
            <button onClick={() => excluirGrupo(activeGrupo.id)} className="btn btn-secondary" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
               <Trash2 size={16} /> Excluir Grupo
            </button>
         </div>

         <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, flex: 1 }}>
            {/* Sidebar Tabs */}
            <div style={{ background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, height: 'fit-content' }}>
               {[
                 { id: 'alunos', label: 'Alunos', icon: Users },
                 { id: 'colaboradores', label: 'Equipe', icon: Shield },
                 { id: 'grupos', label: 'Mesclar', icon: Hexagon }
               ].map(t => (
                 <div key={t.id} onClick={() => setTabDetalhe(t.id as any)} style={{ padding: '14px 16px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: tabDetalhe === t.id ? 'rgba(99, 102, 241, 0.08)' : 'transparent', color: tabDetalhe === t.id ? '#4f46e5' : 'hsl(var(--text-muted))', transition: 'all 0.2s' }}>
                    <t.icon size={18} strokeWidth={tabDetalhe === t.id ? 2.5 : 2} />
                    <span style={{ fontWeight: tabDetalhe === t.id ? 800 : 600 }}>{t.label}</span>
                 </div>
               ))}
            </div>

            {/* Content Area */}
            <div style={{ background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '32px 32px 0 32px' }}>
                    <h3 style={{ fontSize: 20, fontWeight: 800 }}>{tabDetalhe === 'alunos' ? 'Alunos Participantes' : tabDetalhe === 'colaboradores' ? 'Acessos Administrativos' : 'Mesclar Grupos Digitais'}</h3>
                    <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>{tabDetalhe === 'alunos' ? 'Gerencie as famílias que receberão mensagens deste canal.' : tabDetalhe === 'colaboradores' ? 'Quem são os funcionários que podem enviar mensagens aqui?' : 'Selecione abaixo outro grupo para copiar membros.'}</p>
                </div>

                {tabDetalhe !== 'grupos' && (
                  <div style={{ padding: '24px 32px', background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                     <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
                       <Search size={16} style={{ position: 'absolute', left: 16, top: 12, color: 'hsl(var(--text-muted))' }} />
                       <input 
                         className="form-input" 
                         placeholder={tabDetalhe === 'alunos' ? 'Buscar e matricular aluno extra...' : 'Buscar colaborador...'}
                         value={tabDetalhe === 'alunos' ? buscaAluno : buscaColab}
                         onChange={e => tabDetalhe === 'alunos' ? setBuscaAluno(e.target.value) : setBuscaColab(e.target.value)}
                         style={{ paddingLeft: 42, width: '100%', borderRadius: 12 }}
                       />
                       {(tabDetalhe === 'alunos' ? buscaAluno : buscaColab).length > 0 && (
                         <button onClick={() => tabDetalhe === 'alunos' ? setBuscaAluno('') : setBuscaColab('')} style={{ position: 'absolute', right: 12, top: 12, background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}>
                            <X size={14} />
                         </button>
                       )}
                     </div>

                     {/* Dropdown Results */}
                     {tabDetalhe === 'colaboradores' && searchResultsColabs.length > 0 && (
                       <div style={{ marginTop: 8, background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.12)', position: 'absolute', width: '100%', maxWidth: 500, zIndex: 100 }}>
                          {searchResultsColabs.map(f => (
                            <div key={f.id} onClick={() => adicionarColaborador(f.id)} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <UserAvatar userId={f.id} name={f.nome} size={32} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.cargo || 'Colaborador'}</div>
                                </div>
                              </div>
                              {activeGrupo.colaboradoresIds.includes(f.id) ? <Check size={16} color="#10b981" /> : <Plus size={16} />}
                            </div>
                          ))}
                       </div>
                     )}

                     {tabDetalhe === 'alunos' && searchResultsAlunos.length > 0 && (
                       <div style={{ marginTop: 8, background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.12)', position: 'absolute', width: '100%', maxWidth: 500, zIndex: 100 }}>
                          {searchResultsAlunos.map(a => (
                            <div key={a.id} onClick={() => adicionarAluno(a.id)} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                              {activeGrupo.alunosIds.includes(a.id) ? <Check size={16} color="#10b981" /> : <Plus size={16} />}
                            </div>
                          ))}
                       </div>
                     )}
                  </div>
                )}

                <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
                   {tabDetalhe === 'alunos' && (
                      <div style={{ display: 'grid', gap: 12 }}>
                        {alunosVinculados.map(a => (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {a.foto ? (
                                  <img src={a.foto} alt={a.nome} style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'hsl(var(--bg-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-muted))' }}>
                                    {a.nome ? a.nome[0].toUpperCase() : '?'}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.nome}</div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.turma}</div>
                                </div>
                             </div>
                             <button onClick={() => removerAluno(a.id)} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                             </button>
                          </div>
                        ))}
                      </div>
                   )}
                   {tabDetalhe === 'colaboradores' && (
                      <div style={{ display: 'grid', gap: 12 }}>
                        {colsVinculados.map(u => (
                          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                               <UserAvatar userId={u.id} name={u.nome} size={32} />
                               <div style={{ fontWeight: 600 }}>{u.nome}</div>
                             </div>
                             <button onClick={() => removerColaborador(u.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16} /></button>
                          </div>
                        ))}
                      </div>
                   )}
                </div>
            </div>
         </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Gestão de Turmas e Grupos</h2>
            <p style={{ color: 'hsl(var(--text-muted))' }}>Automatize a comunicação criando grupos digitais por turma.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
             <select className="form-input" style={{ width: 160, borderRadius: 20 }} value={anoParaImportar} onChange={e => setAnoParaImportar(e.target.value)}>
                <option value="">Todos Anos</option>
                {cfgCalendarioLetivo.map(c => <option key={c.ano} value={c.ano}>{c.ano}</option>)}
             </select>
             <button onClick={handleAutoSync} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20 }}>
                <DownloadCloud size={18} /> Sincronizar ERP
             </button>
             <motion.button 
               whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
               onClick={() => setShowNovoGrupo(true)} className="btn btn-primary" 
               style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', border: 'none', fontWeight: 800 }}
             >
               <Plus size={18} /> Novo Grupo
             </motion.button>
          </div>
        </div>

        {/* LIST VIEW */}
        <div style={{ background: 'white', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(0,0,0,0.01)' }}>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Grupo / Turma</th>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Alunos</th>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Equipe Responsável</th>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {(grupos || []).map(g => (
                <tr key={g.id} onClick={() => setActiveGrupoId(g.id)} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', transition: 'all 0.2s' }}
                    className="row-hover">
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: g.cor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 8px 16px ${g.cor}33` }}>
                         <BookOpen size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{g.nome}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Mural Digital Ativo</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <Users size={16} color="hsl(var(--text-muted))" />
                       <span style={{ fontWeight: 700, fontSize: 14 }}>{(g.alunosIds || []).length} Alunos</span>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: -8 }}>
                      {(g.colaboradoresIds || []).slice(0, 3).map((colId, idx) => {
                        const colInfo = (funcionarios || []).find(f => f.id === colId)
                        return (
                          <div key={colId} style={{ marginLeft: idx > 0 ? -12 : 0, border: '2px solid white', borderRadius: '50%', background: 'white', zIndex: 10 - idx }}>
                            <UserAvatar userId={colId} name={colInfo?.nome || 'Colaborador'} size={32} />
                          </div>
                        )
                      })}
                      {(g.colaboradoresIds || []).length > 3 && (
                        <div style={{ marginLeft: -12, width: 32, height: 32, borderRadius: 16, background: 'hsl(var(--bg-muted))', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, zIndex: 5 }}>
                          +{(g.colaboradoresIds || []).length - 3}
                        </div>
                      )}
                      {(g.colaboradoresIds || []).length === 0 && <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Nenhuma equipe</span>}
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: 11, fontWeight: 800 }}>
                      <Check size={12} strokeWidth={3} /> Sincronizado
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>Gerenciar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(grupos || []).length === 0 && (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <Search size={40} color="hsl(var(--text-muted))" style={{ opacity: 0.2, marginBottom: 16 }} />
              <p style={{ color: 'hsl(var(--text-muted))' }}>Nenhum grupo encontrado.</p>
            </div>
          )}
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .row-hover:hover { background: rgba(99, 102, 241, 0.02) !important; }
        `}} />

        {/* Modal Novo Grupo */}
        {showNovoGrupo && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ background: 'white', borderRadius: 24, width: 440, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.1)' }}>
               <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Criar Grupo Digital</h3>
               <form onSubmit={criarGrupo} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                 <input className="form-input" placeholder="Nome do Grupo" autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)} required />
                 <div style={{ display: 'flex', gap: 12 }}>
                   {DEFAULT_COLORS.map(c => (
                     <div key={c} onClick={() => setNovaCor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, cursor: 'pointer', border: novaCor === c ? '3px solid white' : 'none' }} />
                   ))}
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                   <button type="button" onClick={() => setShowNovoGrupo(false)} className="btn btn-secondary">Cancelar</button>
                   <button type="submit" className="btn btn-primary" style={{ background: novaCor }}>Criar</button>
                 </div>
               </form>
             </div>
          </div>
        )}
    </div>
  )
}

function Hexagon(props: any) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
  )
}

function DownloadCloud(props: any) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
  )
}

function Shield(props: any) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
  )
}
