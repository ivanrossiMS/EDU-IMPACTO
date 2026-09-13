'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { motion, AnimatePresence } from 'framer-motion';

import { useData } from '@/lib/dataContext'
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LoadingGlass } from '@/components/LoadingGlass'
import { isAlunoCursandoTurma, compareTurmasBySerie, getTurmaSerieWeight } from '@/lib/studentTurmaUtils'
import { 
  BookOpen, Users, Search, Plus, 
  ArrowLeft, X, Trash2, Check,
  Layers, Link2, UserCheck, ChevronRight,
  Shield, Building, GraduationCap, DollarSign,
  Phone, FileText, Pencil, CheckCircle2, AlertCircle,
  Unlink, UserPlus, CheckSquare, Square, Filter, Sparkles
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
const DEFAULT_COLORS = [
  '#4f46e5', '#7c3aed', '#ec4899', '#f43f5e', '#f97316', 
  '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#64748b'
]

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
const EQUIPES_PREDEFINIDAS = [
  { nome: 'Coordenação Pedagógica', icone: 'GraduationCap', cor: '#4f46e5' },
  { nome: 'Secretaria Escolar', icone: 'Building', cor: '#06b6d4' },
  { nome: 'Direção Escolar', icone: 'Shield', cor: '#7c3aed' },
  { nome: 'Financeiro', icone: 'DollarSign', cor: '#10b981' },
  { nome: 'Inspetores & Apoio', icone: 'Users', cor: '#f97316' },
  { nome: 'Recepção', icone: 'Phone', cor: '#f59e0b' },
]

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function ADAdminTurmas() {
  const { turmas = [], cfgCalendarioLetivo = [] } = useData();
  const [alunos] = useSupabaseArray<any>('alunos/lightweight?limit=2000');
  const [grupos, setGrupos] = useSupabaseArray<GrupoDigital>('agenda/grupos');
  const [equipes, setEquipes] = useSupabaseArray<EquipeGrupo>('agenda/equipes');
  const [funcionarios] = useSupabaseArray<any>('configuracoes/usuarios?type=colaboradores&limit=1000');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // ── Estado de Atribuição em Massa de Colaboradores ──────────────────────────
  const [showVincularMassa, setShowVincularMassa] = useState(false)
  const [colabSelecionadoId, setColabSelecionadoId] = useState<string | null>(null)
  const [turmasSelecionadasIds, setTurmasSelecionadasIds] = useState<string[]>([])
  const [buscaColabMassa, setBuscaColabMassa] = useState('')
  const [buscaTurmaMassa, setBuscaTurmaMassa] = useState('')
  const [segmentoFiltroMassa, setSegmentoFiltroMassa] = useState<'todos' | 'infantil' | 'fund1' | 'fund2' | 'medio' | 'equipe'>('todos')
  const [salvandoMassa, setSalvandoMassa] = useState(false)
  const [sucessoMassa, setSucessoMassa] = useState<string | null>(null)

  // Travar o scroll da tela e da página quando o modal de vincular em massa estiver aberto
  useEffect(() => {
    if (!showVincularMassa) return;

    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const scrollContainer = document.querySelector('.ad-main-scroll') as HTMLElement | null;
    const originalScrollOverflow = scrollContainer?.style.overflowY || '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollContainer) {
      scrollContainer.style.overflowY = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      if (scrollContainer) {
        scrollContainer.style.overflowY = originalScrollOverflow;
      }
    };
  }, [showVincularMassa]);

  // Filtro seguro exclusivo para colaboradores (garante que alunos e responsáveis jamais apareçam)
  const apenasColaboradores = useMemo(() => {
    return (funcionarios || []).filter((f: any) => {
      if (!f || !f.id || !f.nome) return false;
      const idStr = String(f.id);
      if (idStr.startsWith('virtual-') || idStr.startsWith('resp-')) return false;
      const p = String(f.perfil || '').toLowerCase();
      const c = String(f.cargo || '').toLowerCase();
      if (p.includes('aluno') || p.includes('família') || p.includes('familia') || p.includes('responsável') || p.includes('responsavel')) return false;
      if (c.includes('aluno') || c.includes('família') || c.includes('familia') || c.includes('responsável') || c.includes('responsavel')) return false;
      return true;
    });
  }, [funcionarios]);

  // ── Dados derivados ──────────────────────────────────────────────────────────
  const activeGrupo = useMemo(() => (grupos || []).find(g => g.id === activeGrupoId), [grupos, activeGrupoId])

  // Lista geral de grupos ordenados por série
  const allGruposOrdenados = useMemo(() => {
    return [...(grupos || [])].sort(compareTurmasBySerie)
  }, [grupos])

  // Colaborador atualmente selecionado para atribuição em massa
  const colabSelecionadoInfo = useMemo(() => {
    if (!colabSelecionadoId) return null
    return apenasColaboradores.find((f: any) => f.id === colabSelecionadoId) || null
  }, [colabSelecionadoId, apenasColaboradores])

  // Turmas originais do colaborador selecionado (para comparar alterações)
  const turmasOriginaisDoColab = useMemo(() => {
    if (!colabSelecionadoId) return []
    return (grupos || []).filter(g => (g.colaboradoresIds || []).includes(colabSelecionadoId)).map(g => g.id)
  }, [colabSelecionadoId, grupos])

  const qtdAdicionadas = useMemo(() => {
    return turmasSelecionadasIds.filter(id => !turmasOriginaisDoColab.includes(id)).length
  }, [turmasSelecionadasIds, turmasOriginaisDoColab])

  const qtdRemovidas = useMemo(() => {
    return turmasOriginaisDoColab.filter(id => !turmasSelecionadasIds.includes(id)).length
  }, [turmasSelecionadasIds, turmasOriginaisDoColab])

  // Filtragem de turmas para o modal de massa
  const turmasFiltradasMassa = useMemo(() => {
    return allGruposOrdenados.filter(g => {
      if (anoParaImportar && g.ano && String(g.ano) !== String(anoParaImportar)) {
        return false
      }
      if (buscaTurmaMassa.trim()) {
        const q = buscaTurmaMassa.toLowerCase().trim()
        const nomeMatch = (g.nome || '').toLowerCase().includes(q)
        const anoMatch = (g.ano || '').toLowerCase().includes(q)
        if (!nomeMatch && !anoMatch) return false
      }
      if (segmentoFiltroMassa !== 'todos') {
        const peso = getTurmaSerieWeight(g)
        if (segmentoFiltroMassa === 'infantil' && (peso < 10 || peso > 59)) return false
        if (segmentoFiltroMassa === 'fund1' && (peso < 101 || peso > 105)) return false
        if (segmentoFiltroMassa === 'fund2' && (peso < 106 || peso > 109)) return false
        if (segmentoFiltroMassa === 'medio' && (peso < 200 || peso > 299)) return false
        if (segmentoFiltroMassa === 'equipe' && !g.isEquipeEscolar && peso < 900) return false
      }
      return true
    })
  }, [allGruposOrdenados, anoParaImportar, buscaTurmaMassa, segmentoFiltroMassa])

  // Ações do modal em massa
  const handleSelectColabParaMassa = (id: string) => {
    setColabSelecionadoId(id)
    const turmasDoColab = (grupos || [])
      .filter(g => (g.colaboradoresIds || []).includes(id))
      .map(g => g.id)
    setTurmasSelecionadasIds(turmasDoColab)
    setBuscaTurmaMassa('')
    setSegmentoFiltroMassa('todos')
  }

  const handleToggleTurmaMassa = (grupoId: string) => {
    setTurmasSelecionadasIds(prev => 
      prev.includes(grupoId) ? prev.filter(id => id !== grupoId) : [...prev, grupoId]
    )
  }

  const handleSelecionarTodasVisiveis = () => {
    const idsVisiveis = turmasFiltradasMassa.map(g => g.id)
    setTurmasSelecionadasIds(prev => Array.from(new Set([...prev, ...idsVisiveis])))
  }

  const handleDesmarcarTodasVisiveis = () => {
    const idsVisiveisSet = new Set(turmasFiltradasMassa.map(g => g.id))
    setTurmasSelecionadasIds(prev => prev.filter(id => !idsVisiveisSet.has(id)))
  }

  const handleSalvarVinculosMassa = async () => {
    if (!colabSelecionadoId) return
    setSalvandoMassa(true)
    try {
      const novosGrupos = (grupos || []).map(g => {
        const deveEstar = turmasSelecionadasIds.includes(g.id)
        const colsAtuais = g.colaboradoresIds || []
        const esta = colsAtuais.includes(colabSelecionadoId)

        if (deveEstar && !esta) {
          return { ...g, colaboradoresIds: [...colsAtuais, colabSelecionadoId] }
        } else if (!deveEstar && esta) {
          return { ...g, colaboradoresIds: colsAtuais.filter((id: string) => id !== colabSelecionadoId) }
        }
        return g
      })
      await setGrupos(novosGrupos)
      setSucessoMassa('Vínculos atualizados com sucesso!')
      setTimeout(() => {
        setSucessoMassa(null)
        setShowVincularMassa(false)
        setColabSelecionadoId(null)
      }, 900)
    } catch (err) {
      console.error('Erro ao salvar vínculos em massa:', err)
    } finally {
      setSalvandoMassa(false)
    }
  }

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
      // O aluno só é incluído na turma se a turma `t` for a turma CURSANDO (matriculado atual) do aluno no ano letivo.
      // Turmas de HISTÓRICO (ANTERIOR) são ignoradas.
      const alunosDaTurma = (alunos || []).filter(a => isAlunoCursandoTurma(a, t, t.ano))
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
    novos.sort(compareTurmasBySerie)
    // Preservar grupos criados manualmente
    const gruposManuais = (grupos || []).filter(g => !g.syncId && !g.id.startsWith('sync-')).sort(compareTurmasBySerie)
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
  const searchResultsColabs = buscaColab.length > 0 ? (apenasColaboradores || []).filter((f: any) => f.nome.toLowerCase().includes(buscaColab.toLowerCase())).slice(0, 10) : []

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-full text-slate-500 font-medium">
      <LoadingGlass />
    </div>
  )



  // ═══════════════════════════════════════════════════════════════════
  // TELA DETALHE DO GRUPO DE TURMA
  // ═══════════════════════════════════════════════════════════════════
  if (telaAtual === 'detalhe-grupo' && activeGrupo) {
    // Filtrar para exibir apenas alunos cuja turma CURSANDO seja este grupo/turma (ignora turmas de HISTÓRICO ANTERIOR)
    const alunosVinculados = (alunos || []).filter((a: any) => {
      const turmaERP = turmas.find(t => (activeGrupo.syncId && (activeGrupo.syncId === `sync-${t.id}` || activeGrupo.id === `sync-${t.id}`)) || t.nome === activeGrupo.nome)
      if (turmaERP) return isAlunoCursandoTurma(a, turmaERP, activeGrupo.ano || turmaERP?.ano)
      return (activeGrupo.alunosIds || []).includes(a.id) || isAlunoCursandoTurma(a, activeGrupo, activeGrupo.ano)
    })
    const colsDiretos = (apenasColaboradores || []).filter((u: any) => (activeGrupo.colaboradoresIds || []).includes(u.id))
    const todosCols = resolveColaboradoresGrupo(activeGrupo)
    const todosFuncionarios = (apenasColaboradores || []).filter((u: any) => todosCols.includes(u.id))

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
                              <UserAvatar userId={f.id} name={f.nome} size={30} fotoUrl={f.foto || f.fotoUrl || f.avatarUrl} />
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
                            <UserAvatar userId={u.id} name={u.nome} size={36} fotoUrl={u.foto || u.fotoUrl || u.avatarUrl} />
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
          <motion.button 
            whileHover={{ scale: 1.04 }} 
            whileTap={{ scale: 0.96 }} 
            onClick={() => { setShowVincularMassa(true); setColabSelecionadoId(null); setBuscaColabMassa(''); setBuscaTurmaMassa(''); }} 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20, fontWeight: 700, border: '1.5px solid #c7d2fe', background: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5' }}
            title="Selecionar um colaborador e atribuir múltiplas turmas de uma vez"
          >
            <UserPlus size={16} /> Vincular em Massa
          </motion.button>
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

        // Ordenar as turmas de cada ano rigorosamente por ordem de série / nível escolar
        Object.keys(gruposPorAno).forEach(chave => {
          gruposPorAno[chave].sort(compareTurmasBySerie)
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
                        const todosColabs = resolveColaboradoresGrupo(g).filter(colId => (apenasColaboradores || []).some((f: any) => f.id === colId))
                        const turmaERP = turmas.find(t => (g.syncId && (g.syncId === `sync-${t.id}` || g.id === `sync-${t.id}`)) || t.nome === g.nome)
                        const alunosDoGrupoCount = (alunos || []).filter((a: any) => {
                          if (turmaERP) return isAlunoCursandoTurma(a, turmaERP, g.ano || turmaERP?.ano)
                          return (g.alunosIds || []).includes(a.id) || isAlunoCursandoTurma(a, g, g.ano)
                        }).length

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
                                  <span style={{ fontWeight: 700, fontSize: 14 }}>{alunosDoGrupoCount}</span>
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: -6 }}>
                                {todosColabs.slice(0, 4).map((colId, idx) => {
                                  const info = (apenasColaboradores || []).find((f: any) => f.id === colId)
                                  return <div key={colId} style={{ marginLeft: idx > 0 ? -10 : 0, border: '2px solid white', borderRadius: '50%', zIndex: 10 - idx }}><UserAvatar userId={colId} name={info?.nome || 'C'} size={28} fotoUrl={info?.foto || info?.fotoUrl || info?.avatarUrl} /></div>
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

      {/* ── Modal Atribuição de Colaborador em Massa ────────────── */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showVincularMassa && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              style={{ 
                position: 'fixed', 
                top: 0, left: 0, right: 0, bottom: 0, 
                width: '100vw',
                height: '100vh',
                background: 'rgba(15, 23, 42, 0.85)', 
                backdropFilter: 'blur(8px)', 
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 9999999, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: 20,
                boxSizing: 'border-box'
              }}
              onClick={e => {
                if (e.target === e.currentTarget) {
                  setShowVincularMassa(false);
                  setColabSelecionadoId(null);
                  setSucessoMassa(null);
                }
              }}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 16 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.95, y: 16 }} 
                transition={{ duration: 0.2 }}
                style={{ 
                  background: 'white', 
                  borderRadius: 24, 
                  width: '100%', 
                  maxWidth: 720, 
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                onClick={e => e.stopPropagation()}
              >
              {/* Top Modal Header */}
              <div style={{ 
                padding: '20px 24px', 
                borderBottom: '1px solid #f1f5f9', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 40, height: 40, borderRadius: 12, 
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: 'white', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' 
                  }}>
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                      Vincular Colaborador em Massa
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                      {colabSelecionadoInfo 
                        ? `Selecione as turmas para ${colabSelecionadoInfo.nome}`
                        : 'Escolha um colaborador para gerenciar os vínculos com múltiplas turmas'
                      }
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowVincularMassa(false); setColabSelecionadoId(null); setSucessoMassa(null); }} 
                  style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    border: '1px solid #e2e8f0', background: 'white', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', color: '#64748b' 
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Success Notification Alert */}
              {sucessoMassa && (
                <div style={{ 
                  margin: '12px 24px 0', 
                  padding: '10px 16px', 
                  borderRadius: 12, 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  border: '1px solid rgba(16, 185, 129, 0.25)', 
                  color: '#059669', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  fontSize: 13, 
                  fontWeight: 700 
                }}>
                  <CheckCircle2 size={16} />
                  {sucessoMassa}
                </div>
              )}

              {/* Modal Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!colabSelecionadoInfo ? (
                  /* ─── PASSO 1: ESCOLHER COLABORADOR ─── */
                  <div>
                    <div style={{ position: 'relative', marginBottom: 16 }}>
                      <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: '#94a3b8' }} />
                      <input
                        className="form-input"
                        placeholder="Buscar colaborador por nome, cargo ou perfil..."
                        value={buscaColabMassa}
                        onChange={e => setBuscaColabMassa(e.target.value)}
                        style={{ paddingLeft: 42, width: '100%', borderRadius: 14, fontSize: 13, height: 42 }}
                        autoFocus
                      />
                      {buscaColabMassa && (
                        <button 
                          onClick={() => setBuscaColabMassa('')}
                          style={{ position: 'absolute', right: 12, top: 12, border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                      {(() => {
                        const listaFiltrada = (apenasColaboradores || [])
                          .filter((f: any) => {
                            if (!buscaColabMassa.trim()) return true
                            const q = buscaColabMassa.toLowerCase().trim()
                            return (f.nome || '').toLowerCase().includes(q) || 
                                   (f.cargo || '').toLowerCase().includes(q) || 
                                   (f.email || '').toLowerCase().includes(q) ||
                                   (f.perfil || '').toLowerCase().includes(q)
                          })
                          .sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))

                        if (listaFiltrada.length === 0) {
                          return (
                            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b' }}>
                              <Users size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Nenhum colaborador encontrado</p>
                              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>Verifique os termos da busca.</p>
                            </div>
                          )
                        }

                        return listaFiltrada.map((f: any) => {
                          const turmasDoColabCount = (grupos || []).filter(g => (g.colaboradoresIds || []).includes(f.id)).length
                          return (
                            <div
                              key={f.id}
                              onClick={() => handleSelectColabParaMassa(f.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                borderRadius: 14,
                                border: '1px solid #f1f5f9',
                                background: '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#f8fafc'
                                e.currentTarget.style.borderColor = '#c7d2fe'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#ffffff'
                                e.currentTarget.style.borderColor = '#f1f5f9'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <UserAvatar userId={f.id} name={f.nome} size={38} fotoUrl={f.foto || f.fotoUrl || f.avatarUrl} />
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>{f.nome}</div>
                                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{f.cargo || f.perfil || 'Colaborador'}</span>
                                    {f.email && <span style={{ opacity: 0.6 }}>· {f.email}</span>}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: 20,
                                  background: turmasDoColabCount > 0 ? 'rgba(79, 70, 229, 0.08)' : 'rgba(148, 163, 184, 0.1)',
                                  color: turmasDoColabCount > 0 ? '#4f46e5' : '#64748b'
                                }}>
                                  {turmasDoColabCount} {turmasDoColabCount === 1 ? 'turma' : 'turmas'}
                                </span>
                                <ChevronRight size={16} color="#94a3b8" />
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                ) : (
                  /* ─── PASSO 2: SELECIONAR TURMAS PARA O COLABORADOR ─── */
                  <div>
                    {/* Card do Colaborador Ativo */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(124, 58, 237, 0.06) 100%)',
                      border: '1.5px solid rgba(99, 102, 241, 0.2)',
                      marginBottom: 16
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <UserAvatar userId={colabSelecionadoInfo.id} name={colabSelecionadoInfo.nome} size={40} fotoUrl={colabSelecionadoInfo.foto || colabSelecionadoInfo.fotoUrl || colabSelecionadoInfo.avatarUrl} />
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 14, color: '#1e293b' }}>
                            {colabSelecionadoInfo.nome}
                          </div>
                          <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
                            {colabSelecionadoInfo.cargo || colabSelecionadoInfo.perfil || 'Colaborador'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setColabSelecionadoId(null)}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#4f46e5',
                          background: 'white',
                          border: '1px solid #c7d2fe',
                          padding: '6px 12px',
                          borderRadius: 10,
                          cursor: 'pointer'
                        }}
                      >
                        Trocar Colaborador
                      </button>
                    </div>

                    {/* Barra de Filtros e Busca de Turmas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                          <input
                            className="form-input"
                            placeholder="Filtrar turmas pelo nome ou turno (ex: Nível 4, Matutino, 8º)..."
                            value={buscaTurmaMassa}
                            onChange={e => setBuscaTurmaMassa(e.target.value)}
                            style={{ paddingLeft: 38, width: '100%', borderRadius: 12, fontSize: 12.5, height: 38 }}
                          />
                          {buscaTurmaMassa && (
                            <button 
                              onClick={() => setBuscaTurmaMassa('')}
                              style={{ position: 'absolute', right: 10, top: 10, border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSelecionarTodasVisiveis}
                          className="btn btn-secondary"
                          style={{ fontSize: 12, fontWeight: 700, padding: '0 14px', borderRadius: 12, whiteSpace: 'nowrap' }}
                        >
                          Marcar Todas ({turmasFiltradasMassa.length})
                        </button>
                        <button
                          type="button"
                          onClick={handleDesmarcarTodasVisiveis}
                          className="btn btn-secondary"
                          style={{ fontSize: 12, fontWeight: 700, padding: '0 14px', borderRadius: 12, whiteSpace: 'nowrap' }}
                        >
                          Desmarcar
                        </button>
                      </div>

                      {/* Pills por Segmento Escolar */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                          { id: 'todos', label: 'Todas' },
                          { id: 'infantil', label: 'Educação Infantil' },
                          { id: 'fund1', label: 'Ens. Fundamental I' },
                          { id: 'fund2', label: 'Ens. Fundamental II' },
                          { id: 'medio', label: 'Ensino Médio' },
                          { id: 'equipe', label: 'Equipe Escolar' }
                        ].map(seg => {
                          const isCurrent = segmentoFiltroMassa === seg.id
                          return (
                            <button
                              key={seg.id}
                              type="button"
                              onClick={() => setSegmentoFiltroMassa(seg.id as any)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 14,
                                fontSize: 11,
                                fontWeight: isCurrent ? 800 : 600,
                                border: isCurrent ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                                background: isCurrent ? '#4f46e5' : '#f8fafc',
                                color: isCurrent ? '#ffffff' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {seg.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Lista Ordenada de Turmas com Checkboxes */}
                    <div style={{ 
                      maxHeight: 380, 
                      overflowY: 'auto', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 6,
                      border: '1px solid #f1f5f9',
                      borderRadius: 16,
                      padding: 8,
                      background: '#fbfcfd'
                    }}>
                      {turmasFiltradasMassa.length === 0 ? (
                        <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                          Nenhuma turma encontrada para o filtro atual.
                        </div>
                      ) : (
                        turmasFiltradasMassa.map(g => {
                          const isSelected = turmasSelecionadasIds.includes(g.id)
                          const wasOriginallyLinked = turmasOriginaisDoColab.includes(g.id)
                          
                          return (
                            <div
                              key={g.id}
                              onClick={() => handleToggleTurmaMassa(g.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: 12,
                                border: isSelected ? '1.5px solid #a5b4fc' : '1px solid #e2e8f0',
                                background: isSelected ? '#eef2ff' : '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: 6,
                                  border: isSelected ? '2px solid #4f46e5' : '2px solid #cbd5e1',
                                  background: isSelected ? '#4f46e5' : '#ffffff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'white', flexShrink: 0
                                }}>
                                  {isSelected && <Check size={14} strokeWidth={3} />}
                                </div>

                                <div style={{
                                  width: 32, height: 32, borderRadius: 10,
                                  background: g.cor || '#6366f1',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'white', flexShrink: 0
                                }}>
                                  <BookOpen size={16} />
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{
                                    fontWeight: 800, fontSize: 13,
                                    color: isSelected ? '#1e1b4b' : '#1e293b',
                                    display: 'flex', alignItems: 'center', gap: 8
                                  }}>
                                    <span>{g.nome}</span>
                                    {g.ano && (
                                      <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                                        {g.ano}
                                      </span>
                                    )}
                                    {g.isEquipeEscolar && (
                                      <span style={{ fontSize: 10, color: '#4f46e5', background: 'rgba(79, 70, 229, 0.1)', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                                        Equipe Escolar
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    {(g.alunosIds || []).length} alunos vinculados
                                  </div>
                                </div>
                              </div>

                              <div>
                                {wasOriginallyLinked && isSelected && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                                    Já vinculado
                                  </span>
                                )}
                                {!wasOriginallyLinked && isSelected && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: 'rgba(79, 70, 229, 0.15)', color: '#4338ca' }}>
                                    + Adicionar
                                  </span>
                                )}
                                {wasOriginallyLinked && !isSelected && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
                                    Remover
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {colabSelecionadoInfo && (
                <div style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc'
                }}>
                  <div style={{ fontSize: 13, color: '#475569' }}>
                    Total selecionado: <strong style={{ color: '#1e293b' }}>{turmasSelecionadasIds.length} turmas</strong>
                    {qtdAdicionadas > 0 && (
                      <span style={{ color: '#059669', fontWeight: 700, marginLeft: 6 }}>
                        (+{qtdAdicionadas} {qtdAdicionadas === 1 ? 'nova' : 'novas'})
                      </span>
                    )}
                    {qtdRemovidas > 0 && (
                      <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: 6 }}>
                        (-{qtdRemovidas} {qtdRemovidas === 1 ? 'removida' : 'removidas'})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => { setShowVincularMassa(false); setColabSelecionadoId(null); }}
                      className="btn btn-secondary"
                      style={{ borderRadius: 12, fontWeight: 700 }}
                      disabled={salvandoMassa}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSalvarVinculosMassa}
                      className="btn btn-primary"
                      style={{
                        borderRadius: 12,
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
                      }}
                      disabled={salvandoMassa}
                    >
                      {salvandoMassa ? (
                        <span>Salvando...</span>
                      ) : (
                        <>
                          <Check size={16} strokeWidth={3} />
                          <span>Salvar Vínculos</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
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
