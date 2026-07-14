'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useData, EventoAgenda, newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Save, Filter, Users, Globe, UserCheck, Search, Edit2, Sparkles, Check, Calendar, Trash, PieChart, Clock, Activity, FileText, GraduationCap, MapPin, Info, Bus, Sun } from 'lucide-react'
import { createPortal } from 'react-dom'
import { TurmaDropdown } from '@/app/agenda-digital/colaborador/components/TurmaDropdown'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface SysUser { id: string; nome: string; email: string; cargo: string; perfil: string; status: 'ativo' | 'inativo'; twofa: boolean; ultimoAcesso: string }
type TipoEvento = EventoAgenda['tipo']

const TIPO_CORES: Record<TipoEvento, string> = {
  aula: '#3b82f6', evento: '#f59e0b', prova: '#ef4444', reuniao: '#8b5cf6',
  feriado: '#6b7280', excursao: '#10b981', entrega: '#06b6d4', atividade: '#ec4899',
}
const TIPO_LABELS: Record<TipoEvento, string> = {
  aula: 'Aula', evento: 'Evento', prova: 'Prova/Avaliação', reuniao: 'Reunião',
  feriado: 'Feriado', excursao: 'Excursão', entrega: 'Entrega', atividade: 'Atividade'
}

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }
function todayStr() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

// ── Visibilidade Selector (Interface Principal) ───────────────────────────────
function VisibilidadeSelector({
  turmasSel,
  usuarioSel,
  tipo,
  anoTodos,
  anosLetivos,
  onChangeAnoTodos,
  onOpenModal,
  onChangeTipo
}: {
  turmasSel: string[]
  usuarioSel: string
  tipo: 'todos' | 'turmas' | 'usuario'
  anoTodos?: string
  anosLetivos?: string[]
  onChangeAnoTodos?: (ano: string) => void
  onOpenModal: (type: 'turmas' | 'usuario') => void
  onChangeTipo: (tipo: 'todos' | 'turmas' | 'usuario') => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Abas de Tipo */}
      <div style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
        {[
          { v: 'todos', label: 'Toda a instituição', icon: Globe },
          { v: 'turmas', label: 'Grupos específicos', icon: Users },
          { v: 'usuario', label: 'Usuário do sistema', icon: UserCheck },
        ].map(opt => (
          <button key={opt.v} type="button"
            onClick={() => onChangeTipo(opt.v as any)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              background: tipo === opt.v ? '#fff' : 'transparent',
              boxShadow: tipo === opt.v ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              border: 'none',
              color: tipo === opt.v ? '#6366f1' : '#64748b', cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
            <opt.icon size={13} /> {opt.label}
          </button>
        ))}
      </div>

      {/* Conteúdo Dinâmico */}
      {tipo === 'todos' && (
        <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, border: '1.5px dashed rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>🌐 Evento visível para todos os usuários matriculados/ativos no ano letivo selecionado.</span>
          {anosLetivos && anosLetivos.length > 0 && onChangeAnoTodos && (
            <select 
              className="form-select" 
              style={{ width: '100%', maxWidth: 300, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.3)', background: '#fff', color: '#047857', cursor: 'pointer' }}
              value={anoTodos || ''}
              onChange={(e) => onChangeAnoTodos(e.target.value)}
            >
              <option value="">Selecione o Ano Letivo (Obrigatório)</option>
              {anosLetivos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      )}

      {tipo === 'turmas' && (
        <div 
          onClick={() => onOpenModal('turmas')}
          style={{ padding: '12px 16px', background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
              {turmasSel.length === 0 ? 'Nenhum grupo selecionado' : `${turmasSel.length} Grupos Selecionados`}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {turmasSel.length === 0 ? 'Clique para buscar e selecionar os grupos' : turmasSel.join(', ').slice(0, 50) + (turmasSel.length > 50 ? '...' : '')}
            </span>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
             <Search size={16} />
          </div>
        </div>
      )}

      {tipo === 'usuario' && (
        <div 
          onClick={() => onOpenModal('usuario')}
          style={{ padding: '12px 16px', background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
              {usuarioSel === 'Todos' || !usuarioSel ? 'Selecionar Usuário' : usuarioSel}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {usuarioSel === 'Todos' || !usuarioSel ? 'Clique para buscar um usuário específico' : 'Usuário destino deste evento'}
            </span>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
             <Search size={16} />
          </div>
        </div>
      )}
    </div>
  )
}

const BLANK_EVENTO: Omit<EventoAgenda, 'id' | 'createdAt'> & { dataFim?: string } = {
  titulo: '', descricao: '', tipo: 'evento', data: '', horaInicio: '', horaFim: '',
  turmas: [], local: '', cor: '#f59e0b', recorrente: false, criadoPor: 'Usuário',
  confirmacaoNecessaria: false, confirmados: [], unidade: '',
  diaTodo: false, dataFim: ''
}

export default function CalendarioPage() {
  const { eventosAgenda = [], setEventosAgenda, cfgCalendarioLetivo = [] } = useData()
  const [turmas = []] = useSupabaseArray<any>('turmas')
  const [sysUsers] = useSupabaseArray<any>('configuracoes/usuarios')
  const usuariosAtivos = sysUsers || []

  const anosLetivos = useMemo(() => {
    const anos = new Set<string>();
    cfgCalendarioLetivo.forEach((c: any) => c.ano && anos.add(String(c.ano)));
    turmas.forEach(t => {
      if (t.ano) anos.add(String(t.ano));
      if (t.ano_letivo) anos.add(String(t.ano_letivo));
    });
    return Array.from(anos).sort().reverse();
  }, [turmas, cfgCalendarioLetivo])

  const [selectedAno, setSelectedAno] = useState<string>('')

  const turmasNomes = useMemo(() => turmas.map(t => t.nome).filter((v, i, a) => v && a.indexOf(v) === i).sort(), [turmas])

  const turmasFiltradas = useMemo(() => {
    if (!selectedAno) return [];
    return turmas
      .filter(t => String(t.ano) === selectedAno || String(t.ano_letivo) === selectedAno)
      .map(t => t.nome)
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .sort();
  }, [turmas, selectedAno])

  const hoje = new Date()
  const [viewDate, setViewDate] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr())
  const [showModal, setShowModal] = useState(false)
  const [showSelectionModal, setShowSelectionModal] = useState<{ open: boolean, type: 'turmas' | 'usuario' }>({ open: false, type: 'turmas' })
  const [searchTermSelection, setSearchTermSelection] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<EventoAgenda, 'id' | 'createdAt'> & { dataFim?: string }>(BLANK_EVENTO)

  const [visibilidade, setVisibilidade] = useState<{ tipo: 'todos' | 'turmas' | 'usuario'; turmasSel: string[]; usuario: string; anoTodos: string }>({
    tipo: 'todos', turmasSel: [], usuario: 'Todos', anoTodos: ''
  })

  const [filtroTurma, setFiltroTurma] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | 'todos'>('todos')
  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [filtroAnoLetivoPrincipal, setFiltroAnoLetivoPrincipal] = useState<string>('todos')

  const turmasFiltroBar = useMemo(() => {
    if (filtroAnoLetivoPrincipal === 'todos') return turmasNomes
    return turmas
      .filter(t => String(t.ano || t.ano_letivo) === filtroAnoLetivoPrincipal)
      .map(t => t.nome)
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .sort()
  }, [turmas, turmasNomes, filtroAnoLetivoPrincipal])

  const turmaDropdownOptions = useMemo(() => {
    return turmasFiltroBar.map(t => ({ id: t, nome: t }));
  }, [turmasFiltroBar]);

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = todayStr()

  const getDateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const eventosFiltrados = useMemo(() => eventosAgenda.filter(e => {
    const isTodosAno = (e.turmas ?? []).find(t => t.startsWith('TODOS:'));
    let matchTurma = false;
    
    if (filtroTurma === 'todas' || (e.turmas ?? []).length === 0) {
      matchTurma = true;
    } else if (isTodosAno) {
      const anoTarget = isTodosAno.split(':')[1];
      const selectedTurmaObj = turmas.find(t => t.nome === filtroTurma);
      if (selectedTurmaObj) {
        const tAno = selectedTurmaObj.ano !== undefined ? String(selectedTurmaObj.ano) : String(selectedTurmaObj.ano_letivo || '');
        if (tAno === anoTarget) matchTurma = true;
      }
    } else if ((e.turmas ?? []).includes(filtroTurma)) {
      matchTurma = true;
    }
    
    const matchTipo = filtroTipo === 'todos' || e.tipo === filtroTipo
    const matchUsuario = filtroUsuario === 'todos' || (e as any).visibilidadeUsuario === filtroUsuario || (e as any).visibilidadeUsuario === undefined
    return matchTurma && matchTipo && matchUsuario
  }), [eventosAgenda, filtroTurma, filtroTipo, filtroUsuario, turmas])

  const eventosPorDia = (dateStr: string) => eventosFiltrados.filter(e => e.data === dateStr)
  const selectedEvents = selectedDay ? eventosPorDia(selectedDay) : []

  const handleAdd = () => {
    if (!form.titulo.trim() || !form.data) return
    if (visibilidade.tipo === 'todos' && !visibilidade.anoTodos) {
      alert('Selecione um Ano Letivo para Toda a instituição.')
      return
    }
    const turmasList = visibilidade.tipo === 'turmas' ? visibilidade.turmasSel
      : visibilidade.tipo === 'todos' ? [`TODOS:${visibilidade.anoTodos}`]
      : []
    
    if (editingId) {
      setEventosAgenda(prev => prev.map(e => e.id === editingId ? {
        ...e,
        ...form,
        dataFim: undefined,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : { visibilidadeUsuario: undefined }),
      } : e))
    } else {
      const getDates = (start: string, end?: string) => {
        if (!end || end < start) return [start]
        const dates = []
        let curr = new Date(start + 'T12:00:00')
        const last = new Date(end + 'T12:00:00')
        while (curr <= last) {
          dates.push(curr.toISOString().split('T')[0])
          curr.setDate(curr.getDate() + 1)
        }
        return dates
      }

      const datesToCreate = getDates(form.data, form.dataFim)
      const novosEventos = datesToCreate.map(d => ({
        ...form,
        data: d,
        dataFim: undefined,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        id: newId('EV'),
        createdAt: new Date().toISOString(),
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : {}),
      }))
      setEventosAgenda(prev => [...prev, ...novosEventos])
    }
    setForm({ ...BLANK_EVENTO, data: form.data })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos', anoTodos: '' })
    setEditingId(null)
    setShowModal(false)
  }

  const handleDelete = (id: string) => setEventosAgenda(prev => prev.filter(e => e.id !== id))

  const handleEdit = (ev: EventoAgenda) => {
    setForm({
      titulo: ev.titulo, descricao: ev.descricao, tipo: ev.tipo, data: ev.data,
      horaInicio: ev.horaInicio, horaFim: ev.horaFim, local: ev.local,
      cor: ev.cor, recorrente: ev.recorrente, criadoPor: ev.criadoPor,
      confirmacaoNecessaria: ev.confirmacaoNecessaria, confirmados: ev.confirmados,
      unidade: ev.unidade, turmas: [],
      diaTodo: (ev as any).diaTodo || false,
    })
    let t = 'todos';
    let turmasSel: string[] = [];
    let usuarioStr = 'Todos';
    let anoTodosStr = '';

    if (ev.turmas && ev.turmas.length > 0) {
      if (ev.turmas[0].startsWith('TODOS:')) {
        t = 'todos';
        anoTodosStr = ev.turmas[0].split(':')[1] || '';
      } else if (ev.turmas[0] !== 'TODOS') {
        t = 'turmas';
        turmasSel = ev.turmas;
      }
    } else if ((ev as any).visibilidadeUsuario) {
      t = 'usuario';
      usuarioStr = (ev as any).visibilidadeUsuario;
    }

    setVisibilidade({ tipo: t as any, turmasSel, usuario: usuarioStr, anoTodos: anoTodosStr })
    setEditingId(ev.id)
    setShowModal(true)
  }

  const openNewEventoForDay = (dateStr: string) => {
    setForm({ ...BLANK_EVENTO, data: dateStr })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos', anoTodos: '' })
    setEditingId(null)
    setShowModal(true)
  }

  const proximosEventos = eventosAgenda
    .filter(e => e.data >= today)
    .sort((a, b) => (a.data + a.horaInicio) < (b.data + b.horaInicio) ? -1 : 1)
    .slice(0, 5)

  const eventosMesAtual = useMemo(() => {
    return eventosAgenda.filter(e => {
      if (!e.data) return false;
      const [y, m] = e.data.split('-');
      return parseInt(y) === year && parseInt(m) === month + 1;
    })
  }, [eventosAgenda, year, month])

  const resumoMes = useMemo(() => {
    const total = eventosMesAtual.length;
    const letivos = eventosMesAtual.filter(e => e.tipo === 'aula').length;
    const avaliacoes = eventosMesAtual.filter(e => e.tipo === 'prova').length;
    const reunioes = eventosMesAtual.filter(e => e.tipo === 'reuniao').length;
    const outros = total - letivos - avaliacoes - reunioes;
    
    const pctLetivos = total > 0 ? Math.round((letivos / total) * 100) : 0;
    const pctReunioes = total > 0 ? Math.round((reunioes / total) * 100) : 0;
    const pctAvaliacoes = total > 0 ? Math.round((avaliacoes / total) * 100) : 0;
    const pctOutros = total > 0 ? 100 - pctLetivos - pctReunioes - pctAvaliacoes : 0;

    return { total, letivos, avaliacoes, reunioes, outros, pctLetivos, pctReunioes, pctAvaliacoes, pctOutros };
  }, [eventosMesAtual]);

  const [aniversariantes, setAniversariantes] = useState<any[]>([])
  const [loadingNivers, setLoadingNivers] = useState(false)

  useEffect(() => {
    const fetchNivers = async () => {
      setLoadingNivers(true)
      try {
        const mesView = month + 1
        const [resAlunos, resProfs] = await Promise.all([
          fetch(`/api/alunos/aniversariantes?mes=${mesView}`).then(r => r.json()),
          fetch('/api/rh/funcionarios?lightweight=true').then(r => r.json())
        ])
        
        // Alunos (A API de aniversariantes retorna dataNascimento com N maiúsculo)
        const alunosAniversariantes = (resAlunos.data || []).map((a: any) => {
          const dia = parseInt(a.dataNascimento?.split('-')[2] || '0')
          return { ...a, tipo: 'Aluno', dia }
        })

        // Funcionários
        const funcionariosArray = Array.isArray(resProfs) ? resProfs : []
        const funcionariosAniversariantes = funcionariosArray.filter((p: any) => {
          const data = p.data_nascimento || p.dataNascimento
          if (!data) return false
          const m = parseInt(data.split('-')[1])
          return m === mesView
        }).map((p: any) => {
          const data = p.data_nascimento || p.dataNascimento
          const dia = parseInt(data.split('-')[2] || '0')
          return { ...p, tipo: 'Colaborador', dia }
        })

        const todos = [...alunosAniversariantes, ...funcionariosAniversariantes]
        
        const niversMes = todos.map((p: any) => {
          let isProximo = false
          if (mesView === (hoje.getMonth() + 1)) {
            const diaHoje = hoje.getDate()
            isProximo = p.dia >= diaHoje && p.dia <= (diaHoje + 7)
          }
          return { ...p, isProximo }
        }).sort((a: any, b: any) => a.dia - b.dia)

        setAniversariantes(niversMes)
      } catch (e) { console.error(e) } finally { setLoadingNivers(false) }
    }
    fetchNivers()
  }, [month])

  const renderEventCard = (ev: EventoAgenda, idx: number) => {
    const evColor = ev.cor ?? TIPO_CORES[ev.tipo] ?? '#6366f1'
    
    // Mapeamento de ícones do lado esquerdo
    const getLeftIcon = () => {
      switch(ev.tipo) {
        case 'evento': return <Sun size={24} color={evColor} />;
        case 'excursao': return <MapPin size={24} color={evColor} />;
        case 'reuniao': return <Users size={24} color={evColor} />;
        case 'prova': return <FileText size={24} color={evColor} />;
        case 'aula': return <GraduationCap size={24} color={evColor} />;
        default: return <Calendar size={24} color={evColor} />;
      }
    };

    // Mapeamento de ícones da tag direita
    const getRightIcon = () => {
      switch(ev.tipo) {
        case 'evento': return <Calendar size={13} color={evColor} />;
        case 'excursao': return <Bus size={13} color={evColor} />;
        case 'reuniao': return <Users size={13} color={evColor} />;
        case 'prova': return <FileText size={13} color={evColor} />;
        case 'aula': return <GraduationCap size={13} color={evColor} />;
        default: return <Calendar size={13} color={evColor} />;
      }
    };

    const formatTurmas = (turmas: string[]) => {
      if (!turmas || turmas.length === 0) return 'Turmas: Todas';
      if (turmas[0].startsWith('TODOS')) return 'Turmas: Todas';
      return `Turma: ${turmas.join(', ')}`;
    };

    return (
      <motion.div 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: idx * 0.04 }}
        key={ev.id} 
        style={{ 
          background: '#ffffff',
          borderRadius: '16px',
          display: 'flex',
          position: 'relative',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02), 0 10px 25px rgba(0,0,0,0.04)',
          border: '1px solid #f1f5f9',
          overflow: 'hidden'
        }}
        onMouseEnter={e => { 
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06), 0 16px 32px rgba(0,0,0,0.04)';
        }}
        onMouseLeave={e => { 
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02), 0 10px 25px rgba(0,0,0,0.04)';
        }}
      >
        {/* Borda Esquerda */}
        <div style={{ width: '6px', background: evColor, flexShrink: 0 }}></div>

        {/* Área do Ícone */}
        <div style={{ 
          width: '80px', 
          background: `linear-gradient(135deg, ${evColor}08 0%, ${evColor}15 100%)`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {/* Fundo com bolinhas imitando pattern */}
          <div style={{
             position: 'absolute',
             top: 0, left: 0, right: 0, bottom: 0,
             background: `radial-gradient(circle at 50% 50%, ${evColor}10 2px, transparent 2px)`,
             backgroundSize: '16px 16px',
             opacity: 0.8
          }}></div>
          
          <div style={{ 
            width: '42px', 
            height: '42px', 
            background: '#ffffff', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            zIndex: 1
          }}>
            {getLeftIcon()}
          </div>
        </div>

        {/* Conteúdo Direito */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Tags Superiores */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ 
              fontSize: '11px', fontWeight: 800, color: '#d97706', background: '#fef3c7', padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 4 
            }}>
              <span style={{ color: '#d97706' }}>☀️</span> {(ev as any).diaTodo ? 'Dia todo' : `${ev.horaInicio || '00:00'}${ev.horaFim ? ` - ${ev.horaFim}` : ''}`}
            </div>
            <div style={{ 
              fontSize: '11px', fontWeight: 800, color: evColor, background: `${evColor}15`, padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 4
            }}>
              {getRightIcon()} {TIPO_LABELS[ev.tipo]}
            </div>
          </div>
          
          {/* Título */}
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', fontFamily: 'Outfit, sans-serif', marginTop: '2px' }}>
            {ev.titulo}
          </div>

          {/* Data/Hora */}
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: '2px' }}>
             <Calendar size={14} style={{ color: '#94a3b8' }} /> {(ev as any).diaTodo ? 'Todo o dia • Sem horário definido' : `${ev.horaInicio || ''}${ev.horaFim ? ` - ${ev.horaFim}` : ''}`}
          </div>

          {/* Local, Turma, Descricao e Botões */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(ev.local || (ev.turmas && ev.turmas.length > 0)) && (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {ev.local && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} /> {ev.local}
                    </span>
                  )}
                  {(ev.turmas && ev.turmas.length > 0) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={13} /> {formatTurmas(ev.turmas)}
                    </span>
                  )}
                </div>
              )}
              {ev.descricao && (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={13} /> {ev.descricao}
                </div>
              )}
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={(e) => { e.stopPropagation(); handleEdit(ev); }} style={{ width: 32, height: 32, borderRadius: '10px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                <Edit2 size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }} style={{ width: 32, height: 32, borderRadius: '10px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = '#ffe4e6'} onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}>
                <Trash size={14} />
              </button>
            </div>
          </div>

        </div>
      </motion.div>
    )
  }

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container">
      <style dangerouslySetInnerHTML={{__html: `
        .ad-calendar-grid-columns { display: grid; grid-template-columns: 320px 1fr 320px 320px; gap: 24px; align-items: start; }
        @media (max-width: 1200px) {
           .ad-calendar-grid-columns { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 768px) {
           .ad-calendar-mobile-container .page-header { align-items: center !important; text-align: center !important; }
           .ad-calendar-filter-bar { flex-direction: column !important; align-items: stretch !important; padding: 16px !important; }
           .ad-calendar-grid-columns { grid-template-columns: 1fr !important; }
        }
      `}} />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Calendário Escolar</h1>
          <p className="page-subtitle">{eventosAgenda.length} evento(s) cadastrado(s) • {year}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(BLANK_EVENTO); setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos', anoTodos: '' }); setEditingId(null); setShowModal(true) }}>
          <Plus size={13} />Novo Evento
        </button>
      </div>

      <div className="ad-calendar-filter-bar" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
        <Filter size={13} style={{ color: 'hsl(var(--text-muted))' }} />
        
        <TurmaDropdown 
          turmaOptions={turmaDropdownOptions} 
          selectedTurmaId={filtroTurma === 'todas' ? 'all' : filtroTurma} 
          setSelectedTurmaId={id => setFiltroTurma(id === 'all' ? 'todas' : id)} 
          selectedTurmaName={filtroTurma === 'todas' ? 'Todos os grupos' : filtroTurma}
          anosLetivos={anosLetivos}
          selectedAno={filtroAnoLetivoPrincipal}
          setSelectedAno={ano => { setFiltroAnoLetivoPrincipal(ano); setFiltroTurma('todas'); }}
        />

        <select className="form-input" style={{ width: 'auto', fontSize: 12, minWidth: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* 
        GRID NOVA (4 Colunas) 
      */}
      <div className="ad-calendar-grid-columns">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* === CARD 1: Calendário === */}
        <div className="card" style={{ padding: '24px', borderRadius: 24, background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Calendário</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
               <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ padding: 4, height: 28, width: 28 }}><ChevronLeft size={16} /></button>
               <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewDate(new Date(year - 1, month, 1))} style={{ padding: 4, height: 28, width: 28, opacity: 0.5 }}><ChevronLeft size={16} /></button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{MESES[month]} {year}</div>
            <div style={{ display: 'flex', gap: 8 }}>
               <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewDate(new Date(year + 1, month, 1))} style={{ padding: 4, height: 28, width: 28, opacity: 0.5 }}><ChevronRight size={16} /></button>
               <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ padding: 4, height: 28, width: 28 }}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {DIAS_SEMANA.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, rowGap: 8 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} style={{ color: '#cbd5e1', fontSize: 13, textAlign: 'center', alignSelf: 'center', fontWeight: 500 }}>{getDaysInMonth(year, month-1) - firstDay + i + 1}</div>)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1; const dateStr = getDateStr(d); const events = eventosPorDia(dateStr); const isToday = dateStr === today; const isSelected = dateStr === selectedDay;
              return (
                <button key={d} onClick={() => setSelectedDay(isSelected ? null : dateStr)} onDoubleClick={() => openNewEventoForDay(dateStr)} 
                  style={{ 
                    height: 36, width: 36, margin: '0 auto', borderRadius: 12, 
                    background: isSelected ? '#6366f1' : 'transparent', 
                    border: 'none',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}>
                  <div style={{ fontSize: 13, fontWeight: isSelected || isToday ? 800 : 600, color: isSelected ? '#fff' : isToday ? '#6366f1' : '#334155' }}>{d}</div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>{isSelected ? <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} /> : events.slice(0, 1).map(ev => <div key={ev.id} style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b' }} />)}</div>
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }}></span>
               <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Eventos no dia</span>
            </div>
            <button style={{ 
              padding: '8px 12px', borderRadius: 10, background: '#e0e7ff', color: '#6366f1', 
              border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 
            }} onClick={() => { setForm(BLANK_EVENTO); setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos', anoTodos: '' }); setEditingId(null); setShowModal(true) }}>
              Ver calendário completo &rarr;
            </button>
          </div>
        </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* === CARD 2: Dia Selecionado === */}
        <div className="card" style={{ padding: '24px', borderRadius: 24, background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: 'none', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#6366f1', fontWeight: 800, fontSize: 13 }}>
              <Calendar size={16} /> Dia Selecionado
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
               <span style={{ fontSize: 32, fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>{selectedDay ? parseInt(selectedDay.split('-')[2]) : '--'}</span>
               <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#1e293b' }}>
                    {selectedDay ? `de ${MESES[parseInt(selectedDay.split('-')[1]) - 1]}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                    {selectedDay ? DIAS_SEMANA[new Date(selectedDay + 'T12:00:00').getDay()] + 'ado' : ''}
                  </div>
               </div>
            </div>
            <button style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              Ver dia inteiro ↗
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              {selectedEvents.length} evento(s) neste dia
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, textAlign: 'center', padding: '40px 0' }}>Nenhum evento para este dia.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedEvents.map((ev, idx) => renderEventCard(ev, idx))}
              </div>
            )}
          </div>

          {/* Citação Educacional */}
          <div style={{ padding: '20px 24px', background: '#f8fafc', borderRadius: 16, position: 'relative', marginTop: 'auto' }}>
            <div style={{ position: 'absolute', top: 12, left: 12, color: 'rgba(99, 102, 241, 0.2)', fontSize: 24, lineHeight: 1, fontFamily: 'serif' }}>“</div>
            <div style={{ position: 'absolute', bottom: 12, right: 12, color: 'rgba(99, 102, 241, 0.2)', fontSize: 24, lineHeight: 1, fontFamily: 'serif' }}>”</div>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, fontWeight: 600, fontStyle: 'italic', margin: 0, padding: '0 20px', lineHeight: 1.5 }}>
              A educação transforma sonhos em conquistas.
            </p>
          </div>
        </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* === CARD 3: Próximos Compromissos === */}
        <div className="card" style={{ padding: '24px', borderRadius: 24, background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6366f1', fontWeight: 800, fontSize: 14 }}>
              <Calendar size={18} /> Próximos Compromissos
            </div>
            <button style={{ background: 'transparent', color: '#6366f1', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              Ver todos
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, justifyContent: proximosEventos.length === 0 ? 'center' : 'flex-start' }}>
            {proximosEventos.length === 0 ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                 <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg, #f8faff 0%, #e0e7ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={48} style={{ color: '#a5b4fc' }} />
                 </div>
                 <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Sem compromissos futuros</h4>
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Não há eventos agendados para os próximos dias.</p>
                 </div>
              </div>
            ) : (
              proximosEventos.map((ev) => {
                const [y, m, d] = ev.data.split('-')
                const badgeColor = TIPO_CORES[ev.tipo] || '#cbd5e1'
                return (
                  <div key={ev.id} style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 44, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>{d}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>{MESES[parseInt(m)-1].slice(0,3)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.titulo}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'transparent', border: '1.5px solid #cbd5e1' }}></span>
                        {DIAS_SEMANA[new Date(ev.data + 'T12:00:00').getDay()]} - {ev.horaInicio || 'Dia todo'}
                      </div>
                    </div>
                    <div style={{ padding: '4px 10px', borderRadius: 8, background: `${badgeColor}15`, color: badgeColor, fontSize: 10, fontWeight: 700 }}>
                      {TIPO_LABELS[ev.tipo]}
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <button style={{ 
            marginTop: 16, width: '100%', padding: '14px', borderRadius: 16, 
            background: 'transparent', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)', 
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 
          }}>
            <Calendar size={16} /> Ver todos os eventos
          </button>
        </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* === CARD 4: Aniversariantes do Mês === */}
        <div className="card" style={{ padding: '24px', borderRadius: 24, background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ec4899', fontWeight: 800, fontSize: 14 }}>
              🎂 Aniversariantes do Mês
            </div>
            <button style={{ background: 'transparent', color: '#6366f1', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              Ver todos
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto', maxHeight: 350, paddingRight: 8 }}>
            {loadingNivers ? (
               <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#94a3b8' }}>Buscando...</div>
            ) : aniversariantes.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#94a3b8' }}>Ninguém este mês 🎈</div>
            ) : (
              aniversariantes.map((p, idx) => {
                const isHoje = p.dia === hoje.getDate() && month === hoje.getMonth() && year === hoje.getFullYear();
                return (
                <div key={p.id || idx} style={{ 
                  display: 'flex', gap: 12, alignItems: 'center', 
                  padding: isHoje ? '12px' : '0 0 16px 0',
                  background: isHoje ? 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)' : 'transparent',
                  borderRadius: isHoje ? '16px' : '0',
                  borderTop: isHoje ? '1px solid #fbcfe8' : 'none',
                  borderRight: isHoje ? '1px solid #fbcfe8' : 'none',
                  borderLeft: isHoje ? '1px solid #fbcfe8' : 'none',
                  borderBottom: isHoje ? '1px solid #fbcfe8' : (!isHoje && idx !== aniversariantes.length - 1 ? '1px solid #f1f5f9' : 'none'),
                  marginBottom: isHoje ? '8px' : '0'
                }}>
                  <div style={{ 
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: p.foto ? `url(${p.foto}) center/cover` : isHoje ? '#fce7f3' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: isHoje ? '#ec4899' : '#1e293b'
                  }}>
                    {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: isHoje ? '#db2777' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: isHoje ? '#ec4899' : '#64748b', fontWeight: 500 }}>
                      {p.tipo === 'Aluno' 
                        ? (Array.isArray(p.turma) 
                            ? p.turma.map(id => turmas.find((t:any) => t.id === id || String(t.id) === String(id))?.nome || id).join(', ') 
                            : (turmas.find((t:any) => t.id === p.turma || String(t.id) === String(p.turma))?.nome || p.turma)) || 'Sem Turma' 
                        : p.tipo}
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: isHoje ? '#f472b6' : '#94a3b8', textTransform: 'uppercase' }}>Dia</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: isHoje ? '#db2777' : '#1e293b', lineHeight: 1 }}>{p.dia}</span>
                  </div>
                </div>
              )})
            )}
          </div>
          
          <div style={{ 
            marginTop: 'auto', padding: '16px', borderRadius: 16, background: '#e0e7ff', 
            color: '#6366f1', fontSize: 13, fontWeight: 800, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <Users size={16} /> {aniversariantes.length} aniversariantes neste mês 🎉
          </div>
        </div>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
              <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: '100%', maxWidth: 580, padding: '32px', borderRadius: 32, boxShadow: '0 30px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', margin: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ fontWeight: 900, fontSize: 20, fontFamily: 'Outfit, sans-serif', color: '#1e293b' }}>{editingId ? '⚡ Editar Evento' : '✨ Novo Evento'}</div>
                <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setEditingId(null); }} style={{ background: '#f1f5f9', borderRadius: '50%' }}><X size={18} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Título do Evento</label>
                  <input className="form-input" style={{ borderRadius: 14, height: 48, fontSize: 14, fontWeight: 600 }} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Reunião Pedagógica" />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Data Início</label>
                    <input className="form-input" style={{ borderRadius: 14, height: 48 }} type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Data Final (Opc.)</label>
                    <input className="form-input" style={{ borderRadius: 14, height: 48 }} type="date" value={form.dataFim || ''} min={form.data} disabled={!!editingId} onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Tipo</label>
                    <select className="form-input" style={{ borderRadius: 14, height: 48, fontWeight: 600 }} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as any }))}>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f8fafc', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
                  <input 
                    type="checkbox" 
                    id="diaTodo" 
                    checked={form.diaTodo as any} 
                    onChange={e => setForm(p => ({ ...p, diaTodo: e.target.checked as any }))}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="diaTodo" style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', cursor: 'pointer' }}>Evento de Dia Inteiro</label>
                </div>

                {!form.diaTodo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Horário Início</label>
                      <input className="form-input" style={{ borderRadius: 14, height: 48 }} type="time" value={form.horaInicio} onChange={e => setForm(p => ({ ...p, horaInicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Horário Término</label>
                      <input className="form-input" style={{ borderRadius: 14, height: 48 }} type="time" value={form.horaFim} onChange={e => setForm(p => ({ ...p, horaFim: e.target.value }))} />
                    </div>
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Localização / Link</label>
                  <input className="form-input" style={{ borderRadius: 14, height: 48, fontSize: 14, fontWeight: 600 }} value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} placeholder="Ex: Auditório, Sala 02 ou Google Meet" />
                </div>

                <div style={{ padding: '20px', background: '#f8fafc', borderRadius: 24, border: '1.5px solid #e2e8f0' }}>
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={16} style={{ color: '#6366f1' }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>Público-alvo e Visibilidade</span>
                  </div>
                  <VisibilidadeSelector 
                    tipo={visibilidade.tipo} 
                    turmasSel={visibilidade.turmasSel} 
                    usuarioSel={visibilidade.usuario} 
                    anoTodos={visibilidade.anoTodos}
                    anosLetivos={anosLetivos}
                    onChangeTipo={(t) => setVisibilidade(prev => ({ ...prev, tipo: t }))} 
                    onChangeAnoTodos={(ano) => setVisibilidade(prev => ({ ...prev, anoTodos: ano }))}
                    onOpenModal={(type) => setShowSelectionModal({ open: true, type })} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" style={{ height: 48, padding: '0 24px', borderRadius: 14, fontWeight: 700 }} onClick={() => setShowModal(false)}>Descartar</button>
                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn btn-primary" 
                  style={{ height: 48, padding: '0 32px', borderRadius: 14, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)' }}
                  onClick={handleAdd}
                >
                  Confirmar e Salvar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSelectionModal.open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(12px)' }}>
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 460, padding: 32, boxShadow: '0 40px 80px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e293b' }}>{showSelectionModal.type === 'turmas' ? '🎯 Selecionar Grupos' : '👤 Selecionar Usuário'}</h3>
                <button onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })} style={{ border: 'none', background: '#f1f5f9', padding: 8, borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
              </div>

              {showSelectionModal.type === 'turmas' && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Selecione o Ano Letivo</label>
                  <select 
                    className="form-input" 
                    style={{ width: '100%', height: 48, borderRadius: 14, fontSize: 14, fontWeight: 600, background: '#f8fafc', border: '1.5px solid #e2e8f0' }}
                    value={selectedAno}
                    onChange={e => setSelectedAno(e.target.value)}
                  >
                    <option value="">Selecione o Ano Letivo...</option>
                    {anosLetivos.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              )}
              
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input autoFocus className="form-input" style={{ paddingLeft: 42, height: 50, borderRadius: 16, fontSize: 14, fontWeight: 600, background: '#f8fafc', border: '1.5px solid #e2e8f0' }} placeholder="O que você está procurando?..." value={searchTermSelection} onChange={e => setSearchTermSelection(e.target.value)} disabled={showSelectionModal.type === 'turmas' && !selectedAno} />
              </div>

              <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                {showSelectionModal.type === 'turmas' ? (
                  !selectedAno ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                      <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Selecione um ano letivo acima para ver as turmas</p>
                    </div>
                  ) : (
                    turmasFiltradas.filter(t => t.toLowerCase().includes(searchTermSelection.toLowerCase())).map(t => {
                      const isSelected = visibilidade.turmasSel.includes(t)
                      return (
                        <motion.button 
                          whileTap={{ scale: 0.98 }}
                          key={t} 
                          onClick={() => setVisibilidade(prev => ({ ...prev, turmasSel: isSelected ? prev.turmasSel.filter(item => item !== t) : [...prev.turmasSel, t] }))} 
                          style={{ width: '100%', padding: '14px 16px', textAlign: 'left', background: isSelected ? '#eff6ff' : 'transparent', border: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`, background: isSelected ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <Check size={14} color="#fff" strokeWidth={4} />}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: isSelected ? 800 : 600, color: isSelected ? '#1e40af' : '#475569' }}>{t}</span>
                        </motion.button>
                      )
                    })
                  )
                ) : (() => {
                  const term = searchTermSelection.toLowerCase();
                  return usuariosAtivos.filter(u => 
                    (u.nome || '').toLowerCase().includes(term) || 
                    (u.cargo || '').toLowerCase().includes(term) || 
                    (u.email || '').toLowerCase().includes(term)
                  ).map(u => {
                    const isSelected = visibilidade.usuario === u.nome
                    return (
                      <motion.button 
                        whileTap={{ scale: 0.98 }}
                        key={u.id} 
                        onClick={() => { setVisibilidade(prev => ({ ...prev, usuario: u.nome })); setShowSelectionModal({ ...showSelectionModal, open: false }) }} 
                        style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: isSelected ? '#eff6ff' : 'transparent', border: 'none', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: isSelected ? '#3b82f6' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: isSelected ? '#fff' : '#6366f1' }}>{u.nome.slice(0, 2).toUpperCase()}</div>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: isSelected ? '#1e40af' : '#1e293b' }}>{u.nome}</div><div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{u.cargo}</div></div>
                        {isSelected && <Check size={18} color="#3b82f6" strokeWidth={3} />}
                      </motion.button>
                    )
                  })
                })()}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 24, height: 50, borderRadius: 16, fontWeight: 900, background: '#1e293b', border: 'none', color: '#fff' }} onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })}>Finalizar Seleção</button>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
