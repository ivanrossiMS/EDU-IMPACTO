'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { motion, AnimatePresence } from 'framer-motion';

import { useData } from '@/lib/dataContext'
import { useState, useEffect, useMemo } from 'react'
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
  const [alunos] = useSupabaseArray<any>('alunos?limit=9999');
  const [grupos, setGrupos] = useSupabaseArray<GrupoDigital>('agenda/grupos');
  const [equipes, setEquipes] = useSupabaseArray<EquipeGrupo>('agenda/equipes');
  const [funcionarios] = useSupabaseArray<any>('configuracoes/usuarios');

  // ── Estado de navegação ─────────────────────────────────────────────────────
  const [telaAtual, setTelaAtual] = useState<'lista' | 'detalhe-grupo' | 'detalhe-equipe'>('lista')
  const [abaLista, setAbaLista] = useState<'turmas' | 'equipes'>('turmas')
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null)
  const [activeEquipeId, setActiveEquipeId] = useState<string | null>(null)
  const [tabDetalheGrupo, setTabDetalheGrupo] = useState<'alunos' | 'colaboradores' | 'equipes'>('alunos')

  // ── Estado de formulários ────────────────────────────────────────────────────
  const [anoParaImportar, setAnoParaImportar] = useState<string>('')
  const [showNovoGrupo, setShowNovoGrupo] = useState(false)
  const [showNovaEquipe, setShowNovaEquipe] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(DEFAULT_COLORS[0])
  const [novoIcone, setNovoIcone] = useState('Users')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [buscaColab, setBuscaColab] = useState('')
  const [buscaMembroEquipe, setBuscaMembroEquipe] = useState('')
  const [isLoaded, setIsLoaded] = useState(false)
  // Filtro de ano letivo na tela de detalhe da equipe
  const [anoFiltroEquipe, setAnoFiltroEquipe] = useState<string>('')
  // Edição de equipe
  const [showEditarEquipe, setShowEditarEquipe] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editCor, setEditCor] = useState(DEFAULT_COLORS[0])
  const [editIcone, setEditIcone] = useState('Users')
  const [editDescricao, setEditDescricao] = useState('')

  // ── Dados derivados ──────────────────────────────────────────────────────────
  const activeGrupo = useMemo(() => (grupos || []).find(g => g.id === activeGrupoId), [grupos, activeGrupoId])
  const activeEquipe = useMemo(() => (equipes || []).find(e => e.id === activeEquipeId), [equipes, activeEquipeId])

  // ── Resolver colaboradores efetivos de um grupo (diretos + herdados de equipes) ─
  const resolveColaboradoresGrupo = (grupo: GrupoDigital): string[] => {
    const diretos = grupo.colaboradoresIds || []
    const deEquipes = (grupo.equipesIds || []).flatMap(equipeId => {
      const eq = (equipes || []).find(e => e.id === equipeId)
      return eq?.membrosIds || []
    })
    return [...new Set([...diretos, ...deEquipes])]
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
      const grupoExistente = (grupos || []).find(g => g.id === `sync-${t.id}` || g.nome === t.nome)
      return {
        id: grupoExistente?.id || `sync-${t.id}`,
        nome: t.nome,
        cor: grupoExistente?.cor || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
        alunosIds: alunosDaTurma.map(a => a.id),
        colaboradoresIds: grupoExistente?.colaboradoresIds || [],
        equipesIds: grupoExistente?.equipesIds || [],
      }
    })
    setGrupos(novos)
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

  const vincularEquipeAoGrupo = (equipeId: string) => {
    if (!activeGrupo) return
    const jaVinculada = (activeGrupo.equipesIds || []).includes(equipeId)
    if (jaVinculada) {
      // Desvincular
      setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, equipesIds: (g.equipesIds || []).filter(e => e !== equipeId) } : g))
    } else {
      // Vincular
      setGrupos((grupos || []).map(g => g.id === activeGrupo.id ? { ...g, equipesIds: [...(g.equipesIds || []), equipeId] } : g))
    }
  }

  // ─── Ações de Equipe ─────────────────────────────────────────────────────────
  const criarEquipe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) return
    const nova: EquipeGrupo = {
      id: `equipe-${Date.now()}`,
      nome: novoNome.trim(),
      cor: novaCor,
      icone: novoIcone,
      descricao: novaDescricao.trim(),
      membrosIds: []
    }
    setEquipes([...(equipes || []), nova])
    setNovoNome(''); setNovaCor(DEFAULT_COLORS[0]); setNovoIcone('Users'); setNovaDescricao('')
    setShowNovaEquipe(false)
  }

  const criarEquipeDaSugestao = (sugestao: typeof SUGESTOES_EQUIPES[0]) => {
    const nova: EquipeGrupo = {
      id: `equipe-${Date.now()}`,
      nome: sugestao.nome,
      cor: sugestao.cor,
      icone: sugestao.icone,
      descricao: '',
      membrosIds: []
    }
    setEquipes([...(equipes || []), nova])
  }

  const excluirEquipe = (id: string) => {
    if (confirm('Excluir esta equipe? Ela será desvinculada de todos os grupos.')) {
      setEquipes((equipes || []).filter(e => e.id !== id))
      // Remover da lista de equipesIds dos grupos que a possuem
      setGrupos((grupos || []).map(g => ({ ...g, equipesIds: (g.equipesIds || []).filter(eid => eid !== id) })))
      setTelaAtual('lista')
    }
  }

  const adicionarMembroEquipe = (userId: string) => {
    if (!activeEquipe || (activeEquipe.membrosIds || []).includes(userId)) return
    setEquipes((equipes || []).map(e => e.id === activeEquipe.id ? { ...e, membrosIds: [...(e.membrosIds || []), userId] } : e))
    setBuscaMembroEquipe('')
  }

  const removerMembroEquipe = (userId: string) => {
    if (!activeEquipe) return
    setEquipes((equipes || []).map(e => e.id === activeEquipe.id ? { ...e, membrosIds: (e.membrosIds || []).filter(m => m !== userId) } : e))
  }

  const abrirEdicaoEquipe = () => {
    if (!activeEquipe) return
    setEditNome(activeEquipe.nome)
    setEditCor(activeEquipe.cor)
    setEditIcone(activeEquipe.icone)
    setEditDescricao(activeEquipe.descricao || '')
    setShowEditarEquipe(true)
  }

  const salvarEdicaoEquipe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEquipe || !editNome.trim()) return
    setEquipes((equipes || []).map(eq =>
      eq.id === activeEquipe.id
        ? { ...eq, nome: editNome.trim(), cor: editCor, icone: editIcone, descricao: editDescricao.trim() }
        : eq
    ))
    setShowEditarEquipe(false)
  }

  // Busca colaboradores
  const searchResultsAlunos = buscaAluno.length > 2 ? (alunos || []).filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())).slice(0, 5) : []
  const searchResultsColabs = buscaColab.length > 0 ? (funcionarios || []).filter((f: any) => f.nome.toLowerCase().includes(buscaColab.toLowerCase())).slice(0, 10) : []
  const searchResultsMembros = buscaMembroEquipe.length > 0 ? (funcionarios || []).filter((f: any) => f.nome.toLowerCase().includes(buscaMembroEquipe.toLowerCase())).slice(0, 10) : []

  if (!isLoaded) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
      <div style={{ width: 48, height: 48, borderRadius: 24, background: 'hsl(var(--bg-surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Layers size={24} style={{ opacity: 0.3 }} />
      </div>
      Carregando turmas e equipes...
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════
  // TELA DETALHE DE EQUIPE
  // ═══════════════════════════════════════════════════════════════════
  if (telaAtual === 'detalhe-equipe' && activeEquipe) {
    const membros = (funcionarios || []).filter((f: any) => (activeEquipe.membrosIds || []).includes(f.id))
    const gruposVinculados = (grupos || []).filter(g => (g.equipesIds || []).includes(activeEquipe.id))
    const IconComp = getIconComponent(activeEquipe.icone)

    // Anos letivos disponíveis (extraídos das turmas ERP)
    const anosDisponiveis = [...new Set(
      turmas.map(t => String(t.ano)).filter(Boolean).sort().reverse()
    )]

    // Grupos filtrados pelo ano selecionado (para "Vincular também em")
    const gruposNaoVinculados = (grupos || []).filter(g => !(g.equipesIds || []).includes(activeEquipe.id))
    const gruposNaoVinculadosFiltrados = anoFiltroEquipe
      ? gruposNaoVinculados.filter(g => {
          // Tenta mapear o grupo de volta à turma ERP pelo id (sync-turmaId)
          const turmaId = g.id.startsWith('sync-') ? g.id.replace('sync-', '') : null
          if (turmaId) {
            const turmaERP = turmas.find(t => String(t.id) === turmaId)
            return turmaERP && String(turmaERP.ano) === anoFiltroEquipe
          }
          // Grupo manual: sem ano → inclui se não houver filtro restritivo
          return true
        })
      : gruposNaoVinculados

    // Grupos já vinculados filtrados pelo ano
    const gruposVinculadosFiltrados = anoFiltroEquipe
      ? gruposVinculados.filter(g => {
          const turmaId = g.id.startsWith('sync-') ? g.id.replace('sync-', '') : null
          if (turmaId) {
            const turmaERP = turmas.find(t => String(t.id) === turmaId)
            return turmaERP && String(turmaERP.ano) === anoFiltroEquipe
          }
          return true
        })
      : gruposVinculados

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button onClick={() => { setTelaAtual('lista'); setAbaLista('equipes'); }} style={{ width: 44, height: 44, borderRadius: 22, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: activeEquipe.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 8px 20px ${activeEquipe.cor}50` }}>
                <IconComp size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', margin: 0 }}>{activeEquipe.nome}</h2>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, margin: 0 }}>{membros.length} membro{membros.length !== 1 ? 's' : ''} · {gruposVinculados.length} turma{gruposVinculados.length !== 1 ? 's' : ''} vinculada{gruposVinculados.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          <button onClick={() => excluirEquipe(activeEquipe.id)} className="btn btn-secondary" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={16} /> Excluir Equipe
          </button>
          <button onClick={abrirEdicaoEquipe} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <Pencil size={15} /> Editar Equipe
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Coluna Membros */}
          <div style={{ background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Users size={18} color={activeEquipe.cor} />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Membros da Equipe</h3>
              </div>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 20 }}>Adicione os colaboradores que fazem parte desta equipe.</p>

              {/* Busca de membros */}
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'hsl(var(--text-muted))' }} />
                <input
                  className="form-input"
                  placeholder="Buscar colaborador..."
                  value={buscaMembroEquipe}
                  onChange={e => setBuscaMembroEquipe(e.target.value)}
                  style={{ paddingLeft: 40, width: '100%', borderRadius: 12 }}
                />
                {buscaMembroEquipe.length > 0 && (
                  <button onClick={() => setBuscaMembroEquipe('')} style={{ position: 'absolute', right: 12, top: 12, background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
                {searchResultsMembros.length > 0 && (
                  <div style={{ position: 'absolute', top: 46, left: 0, right: 0, background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 32px rgba(0,0,0,0.1)', zIndex: 100 }}>
                    {searchResultsMembros.map((f: any) => {
                      const jaEMembro = (activeEquipe.membrosIds || []).includes(f.id)
                      return (
                        <div key={f.id} onClick={() => !jaEMembro && adicionarMembroEquipe(f.id)} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: jaEMembro ? 'default' : 'pointer', opacity: jaEMembro ? 0.5 : 1, background: jaEMembro ? 'rgba(0,0,0,0.02)' : 'white' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <UserAvatar userId={f.id} name={f.nome} size={32} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nome}</div>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.cargo || 'Colaborador'}</div>
                            </div>
                          </div>
                          {jaEMembro ? <Check size={14} color="#10b981" /> : <Plus size={14} />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              {membros.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  <Users size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <p style={{ fontSize: 13 }}>Nenhum membro ainda.<br />Busque e adicione colaboradores acima.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {membros.map((u: any) => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar userId={u.id} name={u.nome} size={36} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{u.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{u.cargo || 'Colaborador'}</div>
                        </div>
                      </div>
                      <button onClick={() => removerMembroEquipe(u.id)} style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Turmas Vinculadas */}
          <div style={{ background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 24px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Link2 size={18} color={activeEquipe.cor} />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Turmas Vinculadas</h3>
              </div>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 14 }}>Grupos de turma que utilizam esta equipe como responsável.</p>

              {/* ── Filtro de Ano Letivo ── */}
              {anosDisponiveis.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Ano letivo:</span>
                  <select
                    className="form-input"
                    value={anoFiltroEquipe}
                    onChange={(e) => setAnoFiltroEquipe(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'white', fontWeight: 700, fontSize: 13, color: 'hsl(var(--text-main))', minWidth: 100, cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">Todos</option>
                    {anosDisponiveis.map(ano => (
                      <option key={ano} value={ano}>{ano}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ padding: '0 24px', flex: 1, overflowY: 'auto' }}>
              {/* Turmas já vinculadas */}
              {gruposVinculadosFiltrados.length === 0 && gruposVinculados.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  <Link2 size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <p style={{ fontSize: 13 }}>Nenhuma turma vinculada.<br />Use a seção abaixo para vincular.</p>
                </div>
              ) : gruposVinculadosFiltrados.length === 0 && anoFiltroEquipe ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  <p style={{ fontSize: 13 }}>Nenhuma turma vinculada em {anoFiltroEquipe}.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
                  {gruposVinculadosFiltrados.map(g => (
                    <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: g.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                          <BookOpen size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{g.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{(g.alunosIds || []).length} alunos</div>
                        </div>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 700 }}>
                        <CheckCircle2 size={11} /> Vinculada
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vincular rápido em outras turmas */}
            {gruposNaoVinculadosFiltrados.length > 0 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {anoFiltroEquipe ? `Vincular em ${anoFiltroEquipe}:` : 'Vincular também em:'}
                  </p>
                  {gruposNaoVinculadosFiltrados.length > 1 && (
                    <button
                      onClick={() => {
                        const idsParaVincular = gruposNaoVinculadosFiltrados.map(g => g.id);
                        setGrupos((grupos || []).map(gg => 
                          idsParaVincular.includes(gg.id) ? { ...gg, equipesIds: [...(gg.equipesIds || []), activeEquipe.id] } : gg
                        ));
                      }}
                      style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: 'none', padding: '4px 10px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                    >
                      <Link2 size={12} /> Vincular Todos ({gruposNaoVinculadosFiltrados.length})
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {gruposNaoVinculadosFiltrados.map(g => (
                    <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px dashed hsl(var(--border-subtle))', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setGrupos((grupos || []).map(gg => gg.id === g.id ? { ...gg, equipesIds: [...(gg.equipesIds || []), activeEquipe.id] } : gg))}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{g.nome}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6366f1', fontWeight: 700 }}>
                        <Link2 size={12} /> Vincular
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ Modal Editar Equipe ══ */}
        <AnimatePresence>
          {showEditarEquipe && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              onClick={e => { if (e.target === e.currentTarget) setShowEditarEquipe(false) }}
            >
              <motion.div
                initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
                style={{ background: 'white', borderRadius: 28, width: 520, padding: '32px', boxShadow: '0 32px 80px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Editar Equipe</h3>
                    <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>Altere nome, descrição, ícone e cor.</p>
                  </div>
                  <button onClick={() => setShowEditarEquipe(false)} style={{ width: 34, height: 34, borderRadius: 17, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={15} />
                  </button>
                </div>

                <form onSubmit={salvarEdicaoEquipe} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Nome da Equipe</label>
                    <input className="form-input" placeholder="Ex: Coordenação Fund. 1" autoFocus value={editNome} onChange={e => setEditNome(e.target.value)} required style={{ width: '100%', borderRadius: 12, fontWeight: 700, fontSize: 15 }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Descrição <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(opcional)</span></label>
                    <input className="form-input" placeholder="Ex: Responsável pelas turmas do Fund. 1" value={editDescricao} onChange={e => setEditDescricao(e.target.value)} style={{ width: '100%', borderRadius: 12 }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Ícone</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {ICONES_EQUIPE.map(ic => {
                        const IconC = ic.icon
                        const isSel = editIcone === ic.id
                        return (
                          <div key={ic.id} onClick={() => setEditIcone(ic.id)} style={{ padding: '12px 0', borderRadius: 14, border: `2px solid ${isSel ? editCor : 'hsl(var(--border-subtle))'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', background: isSel ? `${editCor}10` : 'transparent', transition: 'all 0.15s' }}>
                            <IconC size={20} color={isSel ? editCor : 'hsl(var(--text-muted))'} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: isSel ? editCor : 'hsl(var(--text-muted))' }}>{ic.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Cor</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {DEFAULT_COLORS.map(c => (
                        <div key={c} onClick={() => setEditCor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, cursor: 'pointer', transition: 'all 0.15s', boxShadow: editCor === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none', transform: editCor === c ? 'scale(1.15)' : 'scale(1)' }} />
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '16px 20px', borderRadius: 18, background: `${editCor}08`, border: `1.5px solid ${editCor}30`, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 15, background: editCor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: `0 6px 16px ${editCor}50` }}>
                      {(() => { const P = getIconComponent(editIcone); return <P size={22} /> })()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: editCor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editNome || 'Nome da Equipe'}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editDescricao || 'Descrição da equipe'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                    <button type="button" onClick={() => setShowEditarEquipe(false)} className="btn btn-secondary" style={{ borderRadius: 12 }}>Cancelar</button>
                    <motion.button type="submit" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ background: `linear-gradient(135deg, ${editCor}, ${editCor}cc)`, color: 'white', border: 'none', padding: '10px 26px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={16} /> Salvar Alterações
                    </motion.button>
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
  // TELA DETALHE DO GRUPO DE TURMA
  // ═══════════════════════════════════════════════════════════════════
  if (telaAtual === 'detalhe-grupo' && activeGrupo) {
    const alunosVinculados = (alunos || []).filter((a: any) => (activeGrupo.alunosIds || []).includes(a.id))
    const colsDiretos = (funcionarios || []).filter((u: any) => (activeGrupo.colaboradoresIds || []).includes(u.id))
    const equipesVinculadas = (equipes || []).filter(e => (activeGrupo.equipesIds || []).includes(e.id))
    const todosCols = resolveColaboradoresGrupo(activeGrupo)
    const todosFuncionarios = (funcionarios || []).filter((u: any) => todosCols.includes(u.id))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button onClick={() => { setTelaAtual('lista'); setAbaLista('turmas'); }} style={{ width: 44, height: 44, borderRadius: 22, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: activeGrupo.cor }} />
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', margin: 0 }}>{activeGrupo.nome}</h2>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, margin: 0 }}>{alunosVinculados.length} alunos · {todosFuncionarios.length} colaboradores ({equipesVinculadas.length} equipe{equipesVinculadas.length !== 1 ? 's' : ''})</p>
              </div>
            </div>
          </div>
          <button onClick={() => excluirGrupo(activeGrupo.id)} className="btn btn-secondary" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={16} /> Excluir Grupo
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, flex: 1 }}>
          {/* Tabs */}
          <div style={{ background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, height: 'fit-content' }}>
            {[
              { id: 'alunos', label: 'Alunos', count: alunosVinculados.length, icon: Users, color: '#6366f1' },
              { id: 'equipes', label: 'Equipes', count: equipesVinculadas.length, icon: Shield, color: '#ec4899', badge: equipesVinculadas.length > 0 },
              { id: 'colaboradores', label: 'Diretos', count: colsDiretos.length, icon: UserCheck, color: '#10b981' },
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
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Total equipes</span>
                  <strong>{equipesVinculadas.length}</strong>
                </div>
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

            {/* ── Tab EQUIPES ───────────────────────────────── */}
            {tabDetalheGrupo === 'equipes' && (
              <div style={{ padding: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Shield size={20} color="#ec4899" />
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Equipes Responsáveis</h3>
                </div>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginBottom: 28 }}>
                  Vincule equipes a esta turma. Todos os membros das equipes herdarão acesso ao canal de comunicação desta turma automaticamente.
                </p>

                {/* Equipes disponíveis */}
                {(equipes || []).length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: 16, border: '1px dashed hsl(var(--border-subtle))' }}>
                    <Shield size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
                    <p style={{ fontWeight: 700, marginBottom: 4 }}>Nenhuma equipe criada ainda</p>
                    <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>Crie equipes na aba "Equipes" da página principal.</p>
                    <button onClick={() => { setTelaAtual('lista'); setAbaLista('equipes'); }} className="btn btn-secondary" style={{ borderRadius: 20 }}>
                      Ir para Equipes
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                    {(equipes || []).map(equipe => {
                      const vinculada = (activeGrupo.equipesIds || []).includes(equipe.id)
                      const membrosEquipe = (funcionarios || []).filter((f: any) => (equipe.membrosIds || []).includes(f.id))
                      const EqIcon = getIconComponent(equipe.icone)
                      return (
                        <div key={equipe.id} style={{ border: `2px solid ${vinculada ? equipe.cor : 'hsl(var(--border-subtle))'}`, borderRadius: 18, padding: 18, cursor: 'pointer', transition: 'all 0.25s', background: vinculada ? `${equipe.cor}08` : 'white', position: 'relative', overflow: 'hidden' }}
                          onClick={() => vincularEquipeAoGrupo(equipe.id)}
                          onMouseEnter={e => { if (!vinculada) e.currentTarget.style.borderColor = `${equipe.cor}60`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                          onMouseLeave={e => { if (!vinculada) e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.transform = 'translateY(0)' }}>
                          
                          {vinculada && (
                            <div style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, background: equipe.cor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={13} color="white" strokeWidth={3} />
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: equipe.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 4px 12px ${equipe.cor}40` }}>
                              <EqIcon size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: vinculada ? equipe.cor : 'hsl(var(--text-main))' }}>{equipe.nome}</div>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{membrosEquipe.length} membro{membrosEquipe.length !== 1 ? 's' : ''}</div>
                            </div>
                          </div>

                          {/* Mini avatares dos membros */}
                          {membrosEquipe.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {membrosEquipe.slice(0, 4).map((m: any, idx: number) => (
                                <div key={m.id} style={{ marginLeft: idx > 0 ? -8 : 0, border: '2px solid white', borderRadius: '50%', zIndex: 10 - idx }}>
                                  <UserAvatar userId={m.id} name={m.nome} size={26} />
                                </div>
                              ))}
                              {membrosEquipe.length > 4 && (
                                <div style={{ marginLeft: -8, width: 26, height: 26, borderRadius: 13, background: 'rgba(0,0,0,0.08)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
                                  +{membrosEquipe.length - 4}
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: vinculada ? equipe.cor : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {vinculada ? <><Unlink size={12} /> Clique para desvincular</> : <><Link2 size={12} /> Clique para vincular</>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Resumo colaboradores herdados */}
                {equipesVinculadas.length > 0 && (
                  <div style={{ marginTop: 24, padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, rgba(139,92,246,0.04) 100%)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <CheckCircle2 size={16} color="#6366f1" />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#4f46e5' }}>
                        {todosFuncionarios.length} colaborador{todosFuncionarios.length !== 1 ? 'es' : ''} com acesso via equipes vinculadas
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {todosFuncionarios.map((u: any) => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'white', borderRadius: 20, border: '1px solid rgba(99,102,241,0.15)', fontSize: 12, fontWeight: 600 }}>
                          <UserAvatar userId={u.id} name={u.nome} size={20} />
                          {u.nome.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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

            {/* ── Tab COLABORADORES DIRETOS ─────────────────── */}
            {tabDetalheGrupo === 'colaboradores' && (
              <>
                <div style={{ padding: '28px 28px 0' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Colaboradores Diretos</h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 4 }}>Adicione colaboradores individualmente (sem equipe). <strong>Prefira vincular Equipes</strong> para facilitar a gestão.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 20, width: 'fit-content' }}>
                    <AlertCircle size={13} color="#f59e0b" />
                    <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>Use equipes para colaboração eficiente em múltiplas turmas</span>
                  </div>
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
          <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>Gestão de Turmas e Equipes</h2>
          <p style={{ color: 'hsl(var(--text-muted))', marginTop: 4 }}>Organize grupos digitais de turmas e equipes da escola para comunicação eficiente.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {abaLista === 'turmas' && (
            <>
              <select className="form-input" style={{ width: 140, borderRadius: 20, fontSize: 13 }} value={anoParaImportar} onChange={e => setAnoParaImportar(e.target.value)}>
                <option value="">Todos Anos</option>
                {cfgCalendarioLetivo.map((c: any) => <option key={c.ano} value={c.ano}>{c.ano}</option>)}
              </select>
              <button onClick={handleAutoSync} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, fontWeight: 700 }}>
                <DownloadCloud size={16} /> Sincronizar ERP
              </button>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setShowNovoGrupo(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', fontWeight: 800 }}>
                <Plus size={16} /> Novo Grupo
              </motion.button>
            </>
          )}
          {abaLista === 'equipes' && (
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setShowNovaEquipe(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', border: 'none', fontWeight: 800 }}>
              <Plus size={16} /> Nova Equipe
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Tabs Turmas / Equipes ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'white', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 6, width: 'fit-content' }}>
        {[
          { id: 'turmas', label: 'Turmas e Grupos', icon: BookOpen, count: (grupos || []).length },
          { id: 'equipes', label: 'Equipes da Escola', icon: Shield, count: (equipes || []).length, accent: '#ec4899' },
        ].map(t => {
          const TIcon = t.icon
          const isActive = abaLista === t.id as any
          const accent = t.accent || '#6366f1'
          return (
            <button key={t.id} onClick={() => setAbaLista(t.id as any)} style={{ padding: '10px 20px', borderRadius: 14, border: 'none', cursor: 'pointer', background: isActive ? `${accent}12` : 'transparent', color: isActive ? accent : 'hsl(var(--text-muted))', fontWeight: isActive ? 800 : 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
              <TIcon size={15} />
              {t.label}
              <span style={{ padding: '1px 7px', borderRadius: 8, background: isActive ? `${accent}20` : 'rgba(0,0,0,0.06)', color: isActive ? accent : 'hsl(var(--text-muted))', fontSize: 11, fontWeight: 800 }}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* ── ABA TURMAS ──────────────────────────────────────────────────────── */}
      {abaLista === 'turmas' && (() => {
        // Agrupar turmas por ano letivo
        const gruposPorAno: Record<string, GrupoDigital[]> = {};
        (grupos || []).forEach(g => {
          const turmaId = g.id.startsWith('sync-') ? g.id.replace('sync-', '') : null
          const turmaERP = turmaId ? turmas.find(t => String(t.id) === turmaId) : null
          const ano = turmaERP?.ano ? String(turmaERP.ano) : 'Outros / Sem Ano Letivo'
          if (!gruposPorAno[ano]) gruposPorAno[ano] = []
          gruposPorAno[ano].push(g)
        })

        // Ordenar anos em ordem decrescente (2025, 2024, etc.), deixando "Outros" pro final
        const anosOrdenados = Object.keys(gruposPorAno).sort((a, b) => {
          if (a === 'Outros / Sem Ano Letivo') return 1;
          if (b === 'Outros / Sem Ano Letivo') return -1;
          return b.localeCompare(a);
        })

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
                    Ano Letivo: {ano}
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'hsl(var(--border-subtle))' }} />
                </div>
                
                <div style={{ background: 'white', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(0,0,0,0.01)' }}>
                        {['Grupo / Turma', 'Alunos', 'Equipes', 'Colaboradores', 'Status', ''].map(h => (
                          <th key={h} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gruposPorAno[ano].map(g => {
                        const equipesDoGrupo = (equipes || []).filter(e => (g.equipesIds || []).includes(e.id))
                        const todosColabs = resolveColaboradoresGrupo(g)
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
                                  <div style={{ fontWeight: 800, fontSize: 14 }}>{g.nome}</div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Mural Digital Ativo</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Users size={14} color="hsl(var(--text-muted))" />
                                <span style={{ fontWeight: 700, fontSize: 14 }}>{(g.alunosIds || []).length}</span>
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              {equipesDoGrupo.length === 0 ? (
                                <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Nenhuma</span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {equipesDoGrupo.map(eq => {
                                    const EqI = getIconComponent(eq.icone)
                                    return (
                                      <div key={eq.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: `${eq.cor}15`, color: eq.cor, fontSize: 11, fontWeight: 700 }}>
                                        <EqI size={10} /> {eq.nome}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
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

      {/* ── ABA EQUIPES ────────────────────────────────────────────────────── */}
      {abaLista === 'equipes' && (
        <div>
          {/* Sugestões para criar rápido */}
          {(equipes || []).length === 0 && (
            <div style={{ marginBottom: 24, padding: 24, borderRadius: 20, background: 'linear-gradient(135deg, rgba(236,72,153,0.04) 0%, rgba(139,92,246,0.04) 100%)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>✨ Crie suas equipes com um clique</p>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13, marginBottom: 16 }}>Selecione sugestões pré-configuradas ou crie uma equipe personalizada.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {SUGESTOES_EQUIPES.map(s => {
                  const SIcon = getIconComponent(s.icone)
                  const jaExiste = (equipes || []).some(e => e.nome === s.nome)
                  return (
                    <button key={s.nome} onClick={() => !jaExiste && criarEquipeDaSugestao(s)} disabled={jaExiste} style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${s.cor}`, background: jaExiste ? `${s.cor}15` : 'white', color: jaExiste ? s.cor : 'hsl(var(--text-main))', cursor: jaExiste ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
                      onMouseEnter={e => { if (!jaExiste) e.currentTarget.style.background = `${s.cor}10` }}
                      onMouseLeave={e => { if (!jaExiste) e.currentTarget.style.background = 'white' }}>
                      <SIcon size={14} color={s.cor} />
                      {s.nome}
                      {jaExiste && <Check size={12} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            <AnimatePresence>
              {(equipes || []).map(equipe => {
                const membrosEquipe = (funcionarios || []).filter((f: any) => (equipe.membrosIds || []).includes(f.id))
                const gruposUsando = (grupos || []).filter(g => (g.equipesIds || []).includes(equipe.id))
                const EqIcon = getIconComponent(equipe.icone)
                return (
                  <motion.div key={equipe.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => { setActiveEquipeId(equipe.id); setTelaAtual('detalhe-equipe'); }}
                    style={{ background: 'white', borderRadius: 20, border: '1px solid hsl(var(--border-subtle))', padding: 22, cursor: 'pointer', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 12px 28px ${equipe.cor}20`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = `${equipe.cor}60` }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>

                    {/* Barra lateral colorida */}
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: equipe.cor, borderRadius: '20px 0 0 20px' }} />

                    <div style={{ paddingLeft: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 13, background: equipe.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 6px 16px ${equipe.cor}50` }}>
                            <EqIcon size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{equipe.nome}</div>
                            {equipe.descricao && <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{equipe.descricao}</div>}
                          </div>
                        </div>
                        <ChevronRight size={16} color="hsl(var(--text-muted))" style={{ marginTop: 4, opacity: 0.5 }} />
                      </div>

                      {/* Membros */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {membrosEquipe.slice(0, 5).map((m: any, idx: number) => (
                            <div key={m.id} style={{ marginLeft: idx > 0 ? -8 : 0, border: '2px solid white', borderRadius: '50%', zIndex: 10 - idx }}>
                              <UserAvatar userId={m.id} name={m.nome} size={28} />
                            </div>
                          ))}
                          {membrosEquipe.length > 5 && (
                            <div style={{ marginLeft: -8, width: 28, height: 28, borderRadius: 14, background: 'rgba(0,0,0,0.08)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
                              +{membrosEquipe.length - 5}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                          {membrosEquipe.length} membro{membrosEquipe.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Turmas vinculadas */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {gruposUsando.length === 0 ? (
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Nenhuma turma vinculada</span>
                        ) : gruposUsando.slice(0, 3).map(g => (
                          <span key={g.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${g.cor}15`, color: g.cor, fontWeight: 700 }}>{g.nome}</span>
                        ))}
                        {gruposUsando.length > 3 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>+{gruposUsando.length - 3}</span>}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Card de criar nova equipe */}
            <motion.div whileHover={{ scale: 1.02 }} onClick={() => setShowNovaEquipe(true)} style={{ background: 'transparent', borderRadius: 20, border: '2px dashed hsl(var(--border-subtle))', padding: 22, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 160, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = 'rgba(139,92,246,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'transparent' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={22} color="#8b5cf6" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#8b5cf6', marginBottom: 2 }}>Nova Equipe</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Criar grupo de colaboradores</div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── Modal Novo Grupo de Turma ─────────────────────────── */}
      <AnimatePresence>
        {showNovoGrupo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} style={{ background: 'white', borderRadius: 24, width: 440, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Criar Grupo Digital</h3>
                <button onClick={() => setShowNovoGrupo(false)} style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); const novo: GrupoDigital = { id: `manual-${Date.now()}`, nome: novoNome, cor: novaCor, alunosIds: [], colaboradoresIds: [], equipesIds: [] }; setGrupos([...(grupos || []), novo]); setNovoNome(''); setShowNovoGrupo(false) }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <input className="form-input" placeholder="Nome do Grupo" autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)} required />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cor</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {DEFAULT_COLORS.map(c => (
                      <div key={c} onClick={() => setNovaCor(c)} style={{ width: 32, height: 32, borderRadius: 16, background: c, cursor: 'pointer', border: novaCor === c ? `3px solid ${c}` : '3px solid transparent', boxShadow: novaCor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none', transition: 'all 0.15s' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" onClick={() => setShowNovoGrupo(false)} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ background: novaCor, border: 'none' }}>Criar Grupo</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Nova Equipe ─────────────────────────────────── */}
      <AnimatePresence>
        {showNovaEquipe && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} style={{ background: 'white', borderRadius: 24, width: 500, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Criar Equipe</h3>
                <button onClick={() => setShowNovaEquipe(false)} style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <form onSubmit={criarEquipe} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <input className="form-input" placeholder="Nome da Equipe (ex: Coordenação Fund. 1)" autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)} required />
                <input className="form-input" placeholder="Descrição (opcional)" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} />

                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ícone</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {ICONES_EQUIPE.map(ic => {
                      const IconC = ic.icon
                      const isSelected = novoIcone === ic.id
                      return (
                        <div key={ic.id} onClick={() => setNovoIcone(ic.id)} style={{ padding: '10px 0', borderRadius: 12, border: `2px solid ${isSelected ? novaCor : 'hsl(var(--border-subtle))'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', background: isSelected ? `${novaCor}10` : 'transparent', transition: 'all 0.15s' }}>
                          <IconC size={18} color={isSelected ? novaCor : 'hsl(var(--text-muted))'} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? novaCor : 'hsl(var(--text-muted))' }}>{ic.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cor</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {DEFAULT_COLORS.map(c => (
                      <div key={c} onClick={() => setNovaCor(c)} style={{ width: 32, height: 32, borderRadius: 16, background: c, cursor: 'pointer', boxShadow: novaCor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none', transition: 'all 0.15s' }} />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 16, background: `${novaCor}08`, border: `1px solid ${novaCor}30` }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: novaCor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 4px 12px ${novaCor}50` }}>
                    {(() => { const P = getIconComponent(novoIcone); return <P size={20} /> })()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: novaCor }}>{novoNome || 'Nome da Equipe'}</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{novaDescricao || 'Equipe da escola'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" onClick={() => setShowNovaEquipe(false)} className="btn btn-secondary">Cancelar</button>
                  <button type="submit" style={{ background: `linear-gradient(135deg, ${novaCor}, ${novaCor}cc)`, color: 'white', border: 'none', padding: '10px 24px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Criar Equipe</button>
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
