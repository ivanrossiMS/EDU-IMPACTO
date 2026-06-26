'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { motion, AnimatePresence } from 'framer-motion';

import { useData } from '@/lib/dataContext'
import { useState, useEffect, useMemo } from 'react'
import { LoadingGlass } from '@/components/LoadingGlass'
import { 
  BookOpen, Users, Search, Plus, 
  ArrowLeft, X, Trash2, Check,
  Layers, Link2, UserCheck, ChevronRight,
  Shield, Building, GraduationCap, DollarSign,
  Phone, FileText, Pencil, CheckCircle2, AlertCircle,
  Unlink
} from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

// ─── Tipos ───────────────────────────────────────────────────────────────────
type GrupoDigital = {
  id: string;
  nome: string;
  cor: string;
  alunosIds: string[];
  colaboradoresIds: string[];
  equipesIds?: string[]; // Equipes vinculadas a este grupo de turma
  ano?: string;
  syncId?: string; // ID de sincronização com ERP
  isGlobalAccess?: boolean; // Visível a todos os usuários e com acesso a todas as turmas
  isEquipeEscolar?: boolean; // Visível a todos colaboradores
}

type EquipeGrupo = {
  id: string;
  nome: string;
  cor: string;
  icone: string; // nome do ícone
  descricao?: string;
  membrosIds: string[]; // IDs dos colaboradores/funcionários
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#0ea5e9', '#14b8a6'];

const ICONES_EQUIPE = [
  { id: 'Shield', label: 'Direção', icon: Shield },
  { id: 'GraduationCap', label: 'Coordenação', icon: GraduationCap },
  { id: 'FileText', label: 'Secretaria', icon: FileText },
  { id: 'DollarSign', label: 'Financeiro', icon: DollarSign },
  { id: 'Phone', label: 'Recepção', icon: Phone },
  { id: 'Building', label: 'Diretoria', icon: Building },
  { id: 'Users', label: 'Equipe', icon: Users },
  { id: 'UserCheck', label: 'Suporte', icon: UserCheck },
]

function getIconComponent(iconeId: string) {
  const found = ICONES_EQUIPE.find(i => i.id === iconeId)
  const Comp = found?.icon || Users
  return Comp
}

// ─── Sugestões pré-configuradas de equipes ────────────────────────────────────
const SUGESTOES_EQUIPES = [
  { nome: 'Direção', icone: 'Shield', cor: '#ec4899' },
  { nome: 'Coordenação Fund. 1', icone: 'GraduationCap', cor: '#6366f1' },
  { nome: 'Coordenação Fund. 2', icone: 'GraduationCap', cor: '#8b5cf6' },
  { nome: 'Coordenação Ens. Médio', icone: 'GraduationCap', cor: '#a855f7' },
  { nome: 'Secretaria Escolar', icone: 'FileText', cor: '#3b82f6' },
  { nome: 'Financeiro', icone: 'DollarSign', cor: '#10b981' },
  { nome: 'Recepção', icone: 'Phone', cor: '#f59e0b' },
]

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function ADAdminTurmas() {
  const { turmas = [], cfgCalendarioLetivo = [] } = useData();
  const [alunos] = useSupabaseArray<any>('alunos/lightweight');
  const [grupos, setGrupos] = useSupabaseArray<GrupoDigital>('agenda/grupos');
  const [equipes, setEquipes] = useSupabaseArray<EquipeGrupo>('agenda/equipes');
  const [funcionarios] = useSupabaseArray<any>('configuracoes/usuarios');

  // ── Estado de navegação ─────────────────────────────────────────────────────
  const [telaAtual, setTelaAtual] = useState<'lista' | 'detalhe-grupo'>('lista')
  const [abaLista] = useState<'turmas'>('turmas')
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null)
  const [tabDetalheGrupo, setTabDetalheGrupo] = useState<'alunos' | 'colaboradores'>('alunos')

  // ── Estado de formulários ────────────────────────────────────────────────────
  const [anoParaImportar, setAnoParaImportar] = useState<string>('')
  const [showNovoGrupo, setShowNovoGrupo] = useState(false)
  const [showNovaEquipe, setShowNovaEquipe] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoAno, setNovoAno] = useState('')
  const [novoIsGlobal, setNovoIsGlobal] = useState(false)
  const [novoIsEquipeEscolar, setNovoIsEquipeEscolar] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [novaCor, setNovaCor] = useState(DEFAULT_COLORS[0])
  const [novoIcone, setNovoIcone] = useState('Users')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [buscaColab, setBuscaColab] = useState('')
  const [isLoaded, setIsLoaded] = useState(false)

  // ── Dados derivados ──────────────────────────────────────────────────────────
  const activeGrupo = useMemo(() => (grupos || []).find(g => g.id === activeGrupoId), [grupos, activeGrupoId])

  // ── Resolver colaboradores efetivos de um grupo ───────────────────────────────
  const resolveColaboradoresGrupo = (grupo: GrupoDigital): string[] => {
    return grupo.colaboradoresIds || []
  }

  useEffect(() => {
    if (turmas.length > 0 && (alunos || []).length > 0) setIsLoaded(true)
  }, [turmas, alunos, grupos])

  useEffect(() => {
    if (isLoaded && (grupos || []).length === 0 && turmas.length > 0 && (alunos || []).length > 0) {
      handleAutoSync()
    }
  }, [isLoaded])

  // ─── Sincronização com ERP ───────────────────────────────────────────────────
  const handleAutoSync = () => {
    if (!turmas?.length || !alunos?.length) return
    const turmasFiltradas = turmas.filter(t => !anoParaImportar || String(t.ano) === String(anoParaImportar))
    const novos: GrupoDigital[] = turmasFiltradas.map(t => {
      const alunosDaTurma = (alunos || []).filter(a => {
        const aTurma = String(a.turma || '').trim().toLowerCase()
        const tNome = String(t.nome || '').trim().toLowerCase()
        const tId = String(t.id || '').trim().toLowerCase()
        const tCod = String(t.codigo || '').trim().toLowerCase()
        if (aTurma === tNome || aTurma === tId || aTurma === tCod || String(a.turmaId || '').trim().toLowerCase() === tId) return true
        const aTurmaNorm = aTurma.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
        const tNomeNorm = tNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
        return aTurmaNorm === tNomeNorm && aTurmaNorm !== ''
      })
      const grupoExistente = (grupos || []).find(g => g.syncId === `sync-${t.id}` || g.id === `sync-${t.id}` || g.nome === t.nome)
      return {
        id: grupoExistente?.id || crypto.randomUUID(),
        syncId: `sync-${t.id}`,
        nome: t.nome,
        cor: grupoExistente?.cor || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
        alunosIds: alunosDaTurma.map(a => a.id),
        colaboradoresIds: grupoExistente?.colaboradoresIds || [],
        equipesIds: grupoExistente?.equipesIds || [],
        ano: String(t.ano),
      }
    })
    // Preservar grupos criados manualmente
    const gruposManuais = (grupos || []).filter(g => !g.syncId && !g.id.startsWith('sync-'))
    setGrupos([...gruposManuais, ...novos])
  }

  // ─── Ações de Grupo de Turma ─────────────────────────────────────────────────
  const excluirGrupo = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este grupo digital?')) {
      setGrupos((grupos || []).filter(g => g.id !== id))
      setTelaAtual('lista')
    }
  }

  const adicionarAluno = (id: string) => {
    if (!activeGrupo || (activeGrupo.alunosIds || []).includes(id)) return
    setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, alunosIds: [...(g.alunosIds || []), id] } : g))
    setBuscaAluno('')
  }

  const removerAluno = (id: string) => {
    if (!activeGrupo) return
    setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, alunosIds: (g.alunosIds || []).filter(aid => aid !== id) } : g))
  }

  const adicionarColaboradorDireto = (id: string) => {
    if (!activeGrupo || (activeGrupo.colaboradoresIds || []).includes(id)) return
    setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, colaboradoresIds: [...(g.colaboradoresIds || []), id] } : g))
    setBuscaColab('')
  }

  const removerColaboradorDireto = (id: string) => {
    if (!activeGrupo) return
    setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, colaboradoresIds: (g.colaboradoresIds || []).filter(c => c !== id) } : g))
  }

  // Busca colaboradores
  const searchResultsAlunos = buscaAluno.length > 2 ? (alunos || []).filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())).slice(0, 5) : []
  const searchResultsColabs = buscaColab.length > 0 ? (funcionarios || []).filter((f: any) => f.nome.toLowerCase().includes(buscaColab.toLowerCase())).slice(0, 10) : []

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-full text-slate-500 font-medium">
      <LoadingGlass />
    </div>
  )



  // ═══════════════════════════════════════════════════════════════════
  // TELA DETALHE DO GRUPO DE TURMA
  // ═══════════════════════════════════════════════════════════════════
  if (telaAtual === 'detalhe-grupo' && activeGrupo) {
    const alunosVinculados = (alunos || []).filter((a: any) => (activeGrupo.alunosIds || []).includes(a.id))
    const colsDiretos = (funcionarios || []).filter((u: any) => (activeGrupo.colaboradoresIds || []).includes(u.id))
    const todosCols = resolveColaboradoresGrupo(activeGrupo)
    const todosFuncionarios = (funcionarios || []).filter((u: any) => todosCols.includes(u.id))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button onClick={() => { setTelaAtual('lista'); }} style={{ width: 44, height: 44, borderRadius: 22, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: activeGrupo.cor }} />
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {activeGrupo.nome}
                  {activeGrupo.isEquipeEscolar && <span style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', borderRadius: 20, textTransform: 'none', fontWeight: 700, letterSpacing: 'normal' }}>Equipe Escolar</span>}
                </h2>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, margin: 0 }}>{alunosVinculados.length} alunos · {todosFuncionarios.length} colaboradores</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => { setEditingGroupId(activeGrupo.id); setNovoNome(activeGrupo.nome); setNovoAno(activeGrupo.ano || ''); setNovaCor(activeGrupo.cor); setNovoIsGlobal(!!activeGrupo.isGlobalAccess); setNovoIsEquipeEscolar(!!activeGrupo.isEquipeEscolar); setShowNovoGrupo(true); }} className="btn btn-secondary" style={{ border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pencil size={16} /> Editar Grupo
            </button>
            <button onClick={() => excluirGrupo(activeGrupo.id)} className="btn btn-secondary" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={16} /> Excluir Grupo
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, flex: 1 }}>
          {/* Tabs */}
          <div style={{ background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, height: 'fit-content' }}>
            {[
              { id: 'alunos', label: 'Alunos', count: alunosVinculados.length, icon: Users, color: '#6366f1' },
              { id: 'colaboradores', label: 'Colaboradores', count: colsDiretos.length, icon: UserCheck, color: '#10b981' },
            ].map(t => {
              const IconT = t.icon
              const isActive = tabDetalheGrupo === t.id as any
              return (
                <div key={t.id} onClick={() => setTabDetalheGrupo(t.id as any)} style={{ padding: '12px 14px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isActive ? `${t.color}12` : 'transparent', color: isActive ? t.color : 'hsl(var(--text-muted))', transition: 'all 0.2s', position: 'relative' }}>
                  <IconT size={16} strokeWidth={isActive ? 2.5 : 2} />
                  <span style={{ fontWeight: isActive ? 800 : 600, fontSize: 14, flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: isActive ? `${t.color}20` : 'rgba(0,0,0,0.05)', color: isActive ? t.color : 'hsl(var(--text-muted))', padding: '2px 7px', borderRadius: 8 }}>{t.count}</span>
                </div>
              )
            })}

            {/* Resumo visual */}
            <div style={{ marginTop: 16, padding: '14px', borderRadius: 14, background: 'rgba(0,0,0,0.02)', border: '1px solid hsl(var(--border-subtle))' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Resumo</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Colaboradores</span>
                  <strong>{todosFuncionarios.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Alunos</span>
                  <strong>{alunosVinculados.length}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div style={{ background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Tab ALUNOS ────────────────────────────────── */}
            {tabDetalheGrupo === 'alunos' && (
              <>
                <div style={{ padding: '28px 28px 0' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Alunos Participantes</h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 20 }}>Famílias que recebem mensagens deste canal digital.</p>
                  <div style={{ position: 'relative', width: '100%', maxWidth: 460, marginBottom: 20 }}>
                    <Search size={15} style={{ position: 'absolute', left: 14, top: 12, color: 'hsl(var(--text-muted))' }} />
                    <input className="form-input" placeholder="Adicionar aluno extra..." value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)} style={{ paddingLeft: 40, width: '100%', borderRadius: 12 }} />
                    {searchResultsAlunos.length > 0 && (
                      <div style={{ position: 'absolute', top: 46, left: 0, right: 0, background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 32px rgba(0,0,0,0.1)', zIndex: 100 }}>
                        {searchResultsAlunos.map((a: any) => (
                          <div key={a.id} onClick={() => adicionarAluno(a.id)} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{a.nome}</div>
                            {(activeGrupo.alunosIds || []).includes(a.id) ? <Check size={14} color="#10b981" /> : <Plus size={14} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: '0 28px 28px', flex: 1, overflowY: 'auto' }}>
                  {alunosVinculados.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                      <Users size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
                      <p>Nenhum aluno vinculado.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {alunosVinculados.map((a: any) => (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {a.foto ? <img src={a.foto} alt={a.nome} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} /> : (
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'hsl(var(--bg-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'hsl(var(--text-muted))' }}>{a.nome?.[0]?.toUpperCase() || '?'}</div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.turma}</div>
                            </div>
                          </div>
                          <button onClick={() => removerAluno(a.id)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Tab COLABORADORES ─────────────────────────── */}
            {tabDetalheGrupo === 'colaboradores' && (
              <>
                <div style={{ padding: '28px 28px 0' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Colaboradores</h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 20 }}>Adicione colaboradores vinculados a esta turma.</p>
                  <div style={{ position: 'relative', width: '100%', maxWidth: 460, marginBottom: 20 }}>
                    <Search size={15} style={{ position: 'absolute', left: 14, top: 12, color: 'hsl(var(--text-muted))' }} />
                    <input className="form-input" placeholder="Buscar colaborador..." value={buscaColab} onChange={e => setBuscaColab(e.target.value)} style={{ paddingLeft: 40, width: '100%', borderRadius: 12 }} />
                    {searchResultsColabs.length > 0 && (
                      <div style={{ position: 'absolute', top: 46, left: 0, right: 0, background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 32px rgba(0,0,0,0.1)', zIndex: 100 }}>
                        {searchResultsColabs.map((f: any) => (
                          <div key={f.id} onClick={() => adicionarColaboradorDireto(f.id)} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <UserAvatar userId={f.id} name={f.nome} size={30} />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nome}</div>
                                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.cargo}</div>
                              </div>
                            </div>
                            {(activeGrupo.colaboradoresIds || []).includes(f.id) ? <Check size={14} color="#10b981" /> : <Plus size={14} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: '0 28px 28px', flex: 1, overflowY: 'auto' }}>
                  {colsDiretos.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                      <UserCheck size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
                      <p>Nenhum colaborador direto.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {colsDiretos.map((u: any) => (
                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <UserAvatar userId={u.id} name={u.nome} size={36} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{u.nome}</div>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{u.cargo || 'Colaborador'}</div>
                            </div>
                          </div>
                          <button onClick={() => removerColaboradorDireto(u.id)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <AnimatePresence>
          {showNovoGrupo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'none', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} style={{ background: 'white', borderRadius: 24, width: 440, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Editar Grupo Digital</h3>
                  <button onClick={() => { setShowNovoGrupo(false); setNovoAno(''); setEditingGroupId(null); }} style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); if (editingGroupId) { setGrupos((grupos || []).map(g => g.id === editingGroupId ? { ...g, nome: novoNome, cor: novaCor, ano: novoAno, isGlobalAccess: novoIsGlobal, isEquipeEscolar: novoIsEquipeEscolar } : g)) } setNovoNome(''); setNovoAno(''); setNovoIsGlobal(false); setNovoIsEquipeEscolar(false); setEditingGroupId(null); setShowNovoGrupo(false) }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <input className="form-input" placeholder="Nome do Grupo" autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)} required />
                  
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ano Letivo</p>
                    <select 
                      className="form-input" 
                      value={novoAno} 
                      onChange={e => setNovoAno(e.target.value)}
                      style={{ width: '100%', borderRadius: 12, fontSize: 14 }}
                    >
                      <option value="">Todos / Sem Ano Letivo</option>
                      {cfgCalendarioLetivo.map((c: any) => (
                        <option key={c.ano} value={c.ano}>{c.ano}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cor</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {DEFAULT_COLORS.map(c => (
                        <div key={c} onClick={() => setNovaCor(c)} style={{ width: 32, height: 32, borderRadius: 16, background: c, cursor: 'pointer', border: novaCor === c ? `3px solid ${c}` : '3px solid transparent', boxShadow: novaCor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none', transition: 'all 0.15s' }} />
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(99,102,241,0.05)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)' }}>
                    <input 
                      type="checkbox" 
                      id="isGlobalAccessEdit" 
                      checked={novoIsGlobal} 
                      onChange={e => setNovoIsGlobal(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label htmlFor="isGlobalAccessEdit" style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', cursor: 'pointer' }}>Acesso Global</label>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Visível a todos usuários e tem acesso a todas turmas (menos comunicados, só se for destinatário).</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(234,179,8,0.05)', borderRadius: 14, border: '1px solid rgba(234,179,8,0.1)' }}>
                    <input 
                      type="checkbox" 
                      id="isEquipeEscolarEdit" 
                      checked={novoIsEquipeEscolar} 
                      onChange={e => setNovoIsEquipeEscolar(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label htmlFor="isEquipeEscolarEdit" style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', cursor: 'pointer' }}>Equipe Escolar</label>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Visível a todos os colaboradores para envio de comunicados/momentos.</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" onClick={() => { setShowNovoGrupo(false); setNovoAno(''); setNovoIsGlobal(false); setNovoIsEquipeEscolar(false); setEditingGroupId(null); }} className="btn btn-secondary">Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ background: novaCor, border: 'none' }}>Salvar Alterações</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // TELA PRINCIPAL — Lista de Turmas / Lista de Equipes
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>Gestão de Turmas</h2>
          <p style={{ color: 'hsl(var(--text-muted))', marginTop: 4 }}>Organize grupos digitais de turmas para comunicação eficiente.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="form-input" style={{ width: 140, borderRadius: 20, fontSize: 13 }} value={anoParaImportar} onChange={e => setAnoParaImportar(e.target.value)}>
            <option value="">Todos Anos</option>
            {cfgCalendarioLetivo.map((c: any) => <option key={c.ano} value={c.ano}>{c.ano}</option>)}
          </select>
          <button onClick={handleAutoSync} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, fontWeight: 700 }}>
            <DownloadCloud size={16} /> Sincronizar ERP
          </button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { setEditingGroupId(null); setNovoNome(''); setNovoAno(''); setNovaCor(DEFAULT_COLORS[0]); setNovoIsGlobal(false); setNovoIsEquipeEscolar(false); setShowNovoGrupo(true) }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', fontWeight: 800 }}>
            <Plus size={16} /> Novo Grupo
          </motion.button>
        </div>
      </div>

      {/* ── ABA TURMAS ──────────────────────────────────────────────────────── */}
      {abaLista === 'turmas' && (() => {
        // Agrupar turmas por ano letivo
        const gruposPorAno: Record<string, GrupoDigital[]> = {};
        (grupos || []).forEach(g => {
          const turmaId = g.syncId ? g.syncId.replace('sync-', '') : (g.id.startsWith('sync-') ? g.id.replace('sync-', '') : null)
          const turmaERP = turmaId ? turmas.find(t => String(t.id) === turmaId) : null
          const ano = g.ano !== undefined && g.ano !== null ? g.ano : (turmaERP?.ano ? String(turmaERP.ano) : '')
          const grupoAno = g.isEquipeEscolar ? 'Equipe Escolar' : (ano || 'Outros / Sem Ano Letivo')
          if (!gruposPorAno[grupoAno]) gruposPorAno[grupoAno] = []
          gruposPorAno[grupoAno].push(g)
        })

        // Ordenar anos em ordem decrescente (2025, 2024, etc.), deixando "Outros" pro final
        let anosOrdenados = Object.keys(gruposPorAno).sort((a, b) => {
          if (a === 'Outros / Sem Ano Letivo') return 1;
          if (b === 'Outros / Sem Ano Letivo') return -1;
          return b.localeCompare(a);
        })

        if (anoParaImportar) {
          const anoFiltrado = String(anoParaImportar)
          anosOrdenados = [anoFiltrado]
          
          if (!gruposPorAno[anoFiltrado]) gruposPorAno[anoFiltrado] = []
          
          const gruposSemAno = gruposPorAno['Outros / Sem Ano Letivo'] || []
          gruposSemAno.forEach(g => {
            if (!gruposPorAno[anoFiltrado].some(existing => existing.id === g.id)) {
              gruposPorAno[anoFiltrado].push(g)
            }
          })
        }

        if ((grupos || []).length === 0) {
          return (
            <div style={{ background: 'white', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)', padding: '60px 0', textAlign: 'center' }}>
              <BookOpen size={40} color="hsl(var(--text-muted))" style={{ opacity: 0.2, marginBottom: 16 }} />
              <p style={{ color: 'hsl(var(--text-muted))' }}>Nenhum grupo encontrado. Clique em "Sincronizar ERP".</p>
            </div>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {anosOrdenados.map(ano => (
              <div key={ano}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: '6px 16px', background: 'hsl(var(--bg-muted))', borderRadius: 20, fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-main))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {ano === 'Equipe Escolar' ? 'Equipe Escolar' : `Ano Letivo: ${ano}`}
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'hsl(var(--border-subtle))' }} />
                </div>
                
                <div style={{ background: 'white', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(0,0,0,0.01)' }}>
                        {['Grupo / Turma', ano === 'Equipe Escolar' ? null : 'Alunos', 'Colaboradores', 'Status', ''].filter(Boolean).map(h => (
                          <th key={h as string} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h as string}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gruposPorAno[ano].map(g => {
                        const todosColabs = resolveColaboradoresGrupo(g).filter(colId => (funcionarios || []).some((f: any) => f.id === colId))
                        return (
                          <tr key={g.id} onClick={() => { setActiveGrupoId(g.id); setTelaAtual('detalhe-grupo'); setTabDetalheGrupo('alunos') }} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.02)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: g.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 4px 12px ${g.cor}40` }}>
                                  <BookOpen size={18} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {g.nome}
                                    {g.isEquipeEscolar && <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', borderRadius: 10, fontWeight: 700 }}>Equipe Escolar</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Mural Digital Ativo</div>
                                </div>
                              </div>
                            </td>
                            {ano !== 'Equipe Escolar' && (
                              <td style={{ padding: '16px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Users size={14} color="hsl(var(--text-muted))" />
                                  <span style={{ fontWeight: 700, fontSize: 14 }}>{(g.alunosIds || []).length}</span>
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: -6 }}>
                                {todosColabs.slice(0, 4).map((colId, idx) => {
                                  const info = (funcionarios || []).find((f: any) => f.id === colId)
                                  return <div key={colId} style={{ marginLeft: idx > 0 ? -10 : 0, border: '2px solid white', borderRadius: '50%', zIndex: 10 - idx }}><UserAvatar userId={colId} name={info?.nome || 'C'} size={28} /></div>
                                })}
                                {todosColabs.length > 4 && <div style={{ marginLeft: -10, width: 28, height: 28, borderRadius: 14, background: 'hsl(var(--bg-muted))', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>+{todosColabs.length - 4}</div>}
                                {todosColabs.length === 0 && <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Nenhum</span>}
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 800 }}>
                                <Check size={11} strokeWidth={3} /> Sincronizado
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '5px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>Gerenciar</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      })()}


      {/* ── Modal Novo Grupo de Turma ─────────────────────────── */}
      <AnimatePresence>
        {showNovoGrupo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'none', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} style={{ background: 'white', borderRadius: 24, width: 440, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{editingGroupId ? 'Editar Grupo Digital' : 'Criar Grupo Digital'}</h3>
                <button onClick={() => { setShowNovoGrupo(false); setNovoAno(''); setEditingGroupId(null); }} style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (editingGroupId) { setGrupos((grupos || []).map(g => g.id === editingGroupId ? { ...g, nome: novoNome, cor: novaCor, ano: novoAno, isGlobalAccess: novoIsGlobal, isEquipeEscolar: novoIsEquipeEscolar } : g)) } else { const novo: GrupoDigital = { id: crypto.randomUUID(), nome: novoNome, cor: novaCor, alunosIds: [], colaboradoresIds: [], equipesIds: [], ano: novoAno, isGlobalAccess: novoIsGlobal, isEquipeEscolar: novoIsEquipeEscolar }; setGrupos([...(grupos || []), novo]); } setNovoNome(''); setNovoAno(''); setNovoIsGlobal(false); setNovoIsEquipeEscolar(false); setEditingGroupId(null); setShowNovoGrupo(false) }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <input className="form-input" placeholder="Nome do Grupo" autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)} required />
                
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ano Letivo</p>
                  <select 
                    className="form-input" 
                    value={novoAno} 
                    onChange={e => setNovoAno(e.target.value)}
                    style={{ width: '100%', borderRadius: 12, fontSize: 14 }}
                  >
                    <option value="">Todos / Sem Ano Letivo</option>
                    {cfgCalendarioLetivo.map((c: any) => (
                      <option key={c.ano} value={c.ano}>{c.ano}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cor</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {DEFAULT_COLORS.map(c => (
                      <div key={c} onClick={() => setNovaCor(c)} style={{ width: 32, height: 32, borderRadius: 16, background: c, cursor: 'pointer', border: novaCor === c ? `3px solid ${c}` : '3px solid transparent', boxShadow: novaCor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none', transition: 'all 0.15s' }} />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(99,102,241,0.05)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)' }}>
                  <input 
                    type="checkbox" 
                    id="isGlobalAccess" 
                    checked={novoIsGlobal} 
                    onChange={e => setNovoIsGlobal(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label htmlFor="isGlobalAccess" style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', cursor: 'pointer' }}>Acesso Global</label>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Visível a todos usuários e tem acesso a todas turmas (menos comunicados, só se for destinatário).</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(234,179,8,0.05)', borderRadius: 14, border: '1px solid rgba(234,179,8,0.1)' }}>
                  <input 
                    type="checkbox" 
                    id="isEquipeEscolar" 
                    checked={novoIsEquipeEscolar} 
                    onChange={e => setNovoIsEquipeEscolar(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label htmlFor="isEquipeEscolar" style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', cursor: 'pointer' }}>Equipe Escolar</label>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Visível a todos os colaboradores para envio de comunicados/momentos.</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" onClick={() => { setShowNovoGrupo(false); setNovoAno(''); setNovoIsGlobal(false); setNovoIsEquipeEscolar(false); setEditingGroupId(null); }} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ background: novaCor, border: 'none' }}>{editingGroupId ? 'Salvar Alterações' : 'Criar Grupo'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function DownloadCloud(props: any) {
  return (
    <svg {...props} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
      <path d="M12 12v9"/>
      <path d="m8 17 4 4 4-4"/>
    </svg>
  )
}
