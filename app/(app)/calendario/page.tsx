'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useData, EventoAgenda, newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, Save, Filter, Users, Globe, UserCheck, Search, Edit2, Sparkles, Check, Calendar, Trash, PieChart, Clock, Activity, FileText, GraduationCap, MapPin, Info, Bus, Sun, Download, List, Grid, ArrowRight, ArrowDown, Upload } from 'lucide-react'
import { createPortal } from 'react-dom'
import { TurmaDropdown } from '@/app/agenda-digital/colaborador/components/TurmaDropdown'
import { SelecionarGruposModal } from '@/components/agenda/SelecionarGruposModal'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Abas de Tipo */}
      <div className="ad-vis-tabs">
        {[
          { v: 'todos', label: 'Toda a instituição', shortLabel: 'Instituição', icon: Globe },
          { v: 'turmas', label: 'Grupos específicos', shortLabel: 'Grupos / Turmas', icon: Users },
          { v: 'usuario', label: 'Usuário do sistema', shortLabel: 'Usuário', icon: UserCheck },
        ].map(opt => {
          const isActive = tipo === opt.v
          const IconComp = opt.icon
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChangeTipo(opt.v as any)}
              className={`ad-vis-tab-btn ${isActive ? 'active' : ''}`}
            >
              <div className="ad-vis-tab-icon">
                <IconComp size={15} strokeWidth={isActive ? 2.4 : 2} />
              </div>
              <span className="ad-vis-label-full">{opt.label}</span>
              <span className="ad-vis-label-short">{opt.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Conteúdo Dinâmico */}
      {tipo === 'todos' && (
        <div className="ad-vis-panel-all">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16, 185, 129, 0.14)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Globe size={16} strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600, lineHeight: 1.35 }}>
              Visível para todos os usuários ativos no ano letivo selecionado.
            </span>
          </div>
          {anosLetivos && anosLetivos.length > 0 && onChangeAnoTodos && (
            <select 
              className="form-select ad-ev-input" 
              style={{ width: '100%', padding: '0 32px 0 12px', borderRadius: 11, fontSize: 13, fontWeight: 700, border: '1.5px solid rgba(16, 185, 129, 0.35)', background: '#fff', color: '#047857', cursor: 'pointer' }}
              value={anoTodos || ''}
              onChange={(e) => onChangeAnoTodos(e.target.value)}
            >
              <option value="">Selecione o Ano Letivo (Obrigatório)</option>
              {anosLetivos.map(a => <option key={a} value={a}>Ano Letivo {a}</option>)}
            </select>
          )}
        </div>
      )}

      {tipo === 'turmas' && (
        <button
          type="button"
          onClick={() => onOpenModal('turmas')}
          className="ad-vis-picker-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: turmasSel.length > 0 ? 'rgba(99, 102, 241, 0.12)' : '#f1f5f9', color: turmasSel.length > 0 ? '#4f46e5' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={17} strokeWidth={2.2} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                {turmasSel.length === 0 ? 'Nenhum grupo selecionado' : `${turmasSel.length} grupo${turmasSel.length > 1 ? 's' : ''} selecionado${turmasSel.length > 1 ? 's' : ''}`}
              </span>
              <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left', marginTop: 2 }}>
                {turmasSel.length === 0 ? 'Toque para buscar equipes ou turmas' : turmasSel.join(', ')}
              </span>
            </div>
          </div>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <Search size={13} strokeWidth={2.5} />
            <span>Buscar</span>
          </div>
        </button>
      )}

      {tipo === 'usuario' && (
        <button
          type="button"
          onClick={() => onOpenModal('usuario')}
          className="ad-vis-picker-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: (usuarioSel && usuarioSel !== 'Todos') ? 'rgba(99, 102, 241, 0.12)' : '#f1f5f9', color: (usuarioSel && usuarioSel !== 'Todos') ? '#4f46e5' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCheck size={17} strokeWidth={2.2} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left' }}>
                {usuarioSel === 'Todos' || !usuarioSel ? 'Selecionar usuário' : usuarioSel}
              </span>
              <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                {usuarioSel === 'Todos' || !usuarioSel ? 'Toque para escolher um colaborador' : 'Destinatário exclusivo do evento'}
              </span>
            </div>
          </div>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <Search size={13} strokeWidth={2.5} />
            <span>Buscar</span>
          </div>
        </button>
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
  const [gruposManuais = []] = useSupabaseArray<any>('agenda/grupos')
  const [sysUsers] = useSupabaseArray<any>('configuracoes/usuarios?type=colaboradores&limit=1000')
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
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'mes' | 'semana' | 'dia'>('mes')

  const turmasFiltroBar = useMemo(() => {
    if (filtroAnoLetivoPrincipal === 'todos') return turmasNomes
    return turmas
      .filter(t => String(t.ano || t.ano_letivo) === filtroAnoLetivoPrincipal)
      .map(t => t.nome)
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .sort()
  }, [turmas, turmasNomes, filtroAnoLetivoPrincipal])

  const equipeGruposNomes = useMemo(() => {
    return (gruposManuais || [])
      .filter((g: any) => g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1)
      .map((g: any) => String(g.nome).trim())
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'))
  }, [gruposManuais])

  const turmaDropdownOptions = useMemo(() => {
    const equipeOpts = equipeGruposNomes.map((g: string) => ({ id: g, nome: `${g} (Equipe)` }));
    const turmasOpts = turmasFiltroBar.map(t => ({ id: t, nome: t }));
    return [...equipeOpts, ...turmasOpts];
  }, [equipeGruposNomes, turmasFiltroBar]);

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
    
    const matchSearch = !searchQuery || 
       e.titulo.toLowerCase().includes(searchQuery.toLowerCase()) || 
       (e.local && e.local.toLowerCase().includes(searchQuery.toLowerCase())) || 
       (e.descricao && e.descricao.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchTurma && matchTipo && matchUsuario && matchSearch
  }), [eventosAgenda, filtroTurma, filtroTipo, filtroUsuario, turmas, searchQuery])

  const eventosPorDia = (dateStr: string) => eventosFiltrados.filter(e => e.data === dateStr)
  const selectedEvents = selectedDay ? eventosPorDia(selectedDay) : []

  const isCurrentMonth = today.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
  const hasActiveFilters = filtroTurma !== 'todas' || filtroTipo !== 'todos' || searchQuery.trim() !== ''

  const handleExportEvents = () => {
    if (eventosFiltrados.length === 0) {
      alert('Nenhum evento para exportar no período selecionado.')
      return
    }
    const headers = ['Título', 'Data', 'Horário Início', 'Horário Fim', 'Tipo', 'Local', 'Descrição']
    const csvContent = [
      headers.join(','),
      ...eventosFiltrados.map(e => [
        `"${(e.titulo || '').replace(/"/g, '""')}"`,
        `"${e.data || ''}"`,
        `"${e.horaInicio || ''}"`,
        `"${e.horaFim || ''}"`,
        `"${TIPO_LABELS[e.tipo] || e.tipo}"`,
        `"${(e.local || '').replace(/"/g, '""')}"`,
        `"${(e.descricao || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `calendario_${MESES[month]}_${year}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

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

  const handleDelete = async (id: string) => {
    setEventosAgenda(prev => prev.filter(e => e.id !== id))
    try {
      const res = await fetch(`/api/agenda/eventos?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        console.error('[Calendario] Erro ao excluir no servidor:', await res.text())
      }
    } catch (err) {
      console.error('[Calendario] Erro de rede ao excluir evento:', err)
    }
  }

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
    .filter(e => e.data > today)
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

  const eventosProximos7DiasCount = useMemo(() => {
    const start = new Date(today + 'T12:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().split('T')[0];
    return eventosAgenda.filter(e => e.data >= today && e.data <= endStr).length;
  }, [eventosAgenda, today]);

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
            isProximo = p.dia === diaHoje
          }
          return { ...p, isProximo }
        }).sort((a: any, b: any) => a.dia - b.dia)

        setAniversariantes(niversMes)
      } catch (e) { console.error(e) } finally { setLoadingNivers(false) }
    }
    fetchNivers()
  }, [month])

  const resolveTurmaNomeAluno = useCallback((p: any) => {
    // 1. Se já veio resolvido do endpoint de aniversariantes
    if (p.turmaNome && typeof p.turmaNome === 'string' && p.turmaNome.trim() !== '') {
      const tStr = p.turmaNome.trim()
      if (!/^\d+$/.test(tStr) && !/^[0-9a-fA-F-]{10,}$/.test(tStr)) {
        return tStr
      }
    }

    // 2. Busca na lista de turmas carregada em memória na página
    const ref = String(p.turma || p.dados?.turma || p.dados?.turmaId || p.dados?.dadosMatricula?.turmaId || '').trim()
    if (ref && turmas && turmas.length > 0) {
      const match = turmas.find((t: any) => 
        String(t.id).trim() === ref ||
        String(t.codigo || '').trim().toLowerCase() === ref.toLowerCase() ||
        String(t.nome || '').trim().toLowerCase() === ref.toLowerCase()
      )
      if (match?.nome) return match.nome
    }

    // 3. Verifica dados adicionais
    const dadosNome = p.dados?.turmaNome || p.dados?.dadosMatricula?.turmaNome
    if (dadosNome && !/^\d+$/.test(dadosNome) && !/^[0-9a-fA-F-]{10,}$/.test(dadosNome)) {
      return dadosNome
    }

    // 4. Se p.turma for texto com nome legível (e não ID numérico ou UUID)
    if (p.turma) {
      const tStr = String(p.turma).trim()
      if (!/^\d+$/.test(tStr) && !/^[0-9a-fA-F-]{10,}$/.test(tStr)) {
        return tStr
      }
    }

    return 'Sem turma'
  }, [turmas])

function TurmasBadgeList({ turmas }: { turmas: string[] }) {
  const [showPopover, setShowPopover] = useState(false);

  if (!turmas || turmas.length === 0 || (turmas[0] && (turmas[0].startsWith('TODOS') || turmas[0] === 'TODA A ESCOLA' || turmas[0] === 'TODAS'))) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', fontSize: '11px', fontWeight: 700 }}>
        <Users size={13} style={{ color: '#4338ca' }} />
        <span>Todas as Turmas</span>
      </div>
    );
  }

  const maxVisible = 2;
  const visibleTurmas = turmas.slice(0, maxVisible);
  const remainingCount = turmas.length - maxVisible;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', position: 'relative' }}>
      <Users size={14} style={{ color: '#94a3b8', flexShrink: 0, marginRight: 2 }} />
      {visibleTurmas.map((t, idx) => (
        <span 
          key={idx} 
          title={t}
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            background: '#f1f5f9', 
            border: '1px solid #e2e8f0', 
            color: '#334155', 
            fontSize: '11px', 
            fontWeight: 600,
            maxWidth: '160px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {t}
        </span>
      ))}

      {remainingCount > 0 && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPopover(!showPopover); }} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px', 
              padding: '3px 8px', 
              borderRadius: '6px', 
              background: '#e0e7ff', 
              border: '1px solid #c7d2fe', 
              color: '#4338ca', 
              fontSize: '11px', 
              fontWeight: 700, 
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#c7d2fe'}
            onMouseLeave={e => e.currentTarget.style.background = '#e0e7ff'}
          >
            <span>+{remainingCount} turmas</span>
            <ChevronDown size={12} />
          </button>

          {showPopover && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 49 }} 
                onClick={(e) => { e.stopPropagation(); setShowPopover(false); }} 
              />
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  position: 'absolute', 
                  bottom: 'calc(100% + 6px)', 
                  left: 0, 
                  zIndex: 50, 
                  background: '#ffffff', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', 
                  padding: '12px', 
                  minWidth: '220px',
                  maxWidth: '300px',
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Turmas no evento ({turmas.length})</span>
                  <button type="button" onClick={() => setShowPopover(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {turmas.map((t, idx) => (
                    <div key={idx} style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', background: '#f8fafc', padding: '5px 8px', borderRadius: '6px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

  const renderEventCard = (ev: EventoAgenda, idx: number) => {
    const isPast = Boolean(ev.data && ev.data < today)
    const rawColor = ev.cor ?? TIPO_CORES[ev.tipo] ?? '#6366f1'
    const realColor = String(rawColor).toLowerCase() === '#6b7280' ? '#06b6d4' : rawColor
    const evColor = isPast ? '#64748b' : realColor
    
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

    return (
      <motion.div 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: idx * 0.04 }}
        key={ev.id} 
        style={{ 
          background: isPast
            ? '#f8fafc'
            : `linear-gradient(135deg, #ffffff 0%, ${evColor}0D 100%)`,
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          padding: '24px',
          position: 'relative',
          transition: 'all 0.2s ease',
          boxShadow: isPast
            ? 'none'
            : `0 0 18px ${evColor}50, 0 0 5px ${evColor}80, inset 0 0 12px ${evColor}10`,
          border: isPast
            ? '1.5px solid #cbd5e1'
            : `2px solid ${evColor}`,
          borderLeft: isPast
            ? '5px solid #94a3b8'
            : `6px solid ${evColor}`,
          opacity: isPast ? 0.72 : 1,
          filter: isPast ? 'grayscale(0.65)' : 'none'
        }}
      >
        {/* Left Icon Area */}
        <div style={{ 
          width: '64px', 
          height: '64px',
          borderRadius: '16px',
          background: isPast ? '#e2e8f0' : `${evColor}18`, 
          border: isPast ? '1px solid #cbd5e1' : `1px solid ${evColor}55`,
          boxShadow: isPast ? 'none' : `0 0 12px ${evColor}30`,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {getLeftIcon()}
        </div>

        {/* Center Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ fontSize: '18px', fontWeight: isPast ? 700 : 900, color: isPast ? '#64748b' : '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
              {ev.titulo}
            </div>
            {/* Tags on top right */}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {(ev as any).diaTodo && (
                <div style={{ fontSize: '11px', fontWeight: 800, color: isPast ? '#64748b' : '#6366f1', background: isPast ? '#e2e8f0' : '#e0e7ff', padding: '6px 12px', borderRadius: '10px' }}>
                  Dia todo
                </div>
              )}
              <div style={{
                fontSize: '11px',
                fontWeight: 800,
                color: evColor,
                background: isPast ? '#e2e8f0' : `${evColor}18`,
                border: isPast ? '1px solid #cbd5e1' : `1px solid ${evColor}55`,
                boxShadow: isPast ? 'none' : `0 0 8px ${evColor}25`,
                padding: '6px 12px',
                borderRadius: '10px'
              }}>
                {isPast ? 'Realizado' : TIPO_LABELS[ev.tipo]}
              </div>
            </div>
          </div>
          
          {/* Details Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '12px', color: isPast ? '#94a3b8' : '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Clock size={14} style={{ color: isPast ? '#94a3b8' : evColor }} /> {(ev as any).diaTodo ? 'Todo o dia • Sem horário definido' : `${ev.horaInicio || ''}${ev.horaFim ? ` - ${ev.horaFim}` : ''}`}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
              <TurmasBadgeList turmas={ev.turmas} />
              
              {/* Bottom Right Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); handleEdit(ev); }} style={{ width: 36, height: 36, borderRadius: '10px', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                  <Edit2 size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }} style={{ width: 36, height: 36, borderRadius: '10px', background: '#fff1f2', border: '1.5px solid #ffe4e6', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = '#ffe4e6'} onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}>
                  <Trash size={16} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    )
  }

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container" style={{ background: '#F6F7FB', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-calendar-grid-new { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(420px, 1.15fr) minmax(300px, 0.9fr); gap: 24px; align-items: start; }
        @media (max-width: 1280px) {
           .ad-calendar-grid-new { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 1024px) {
           .ad-calendar-grid-new { grid-template-columns: 1fr; }
           .ad-calendar-summary-cards { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
           .ad-calendar-summary-cards { 
             grid-template-columns: repeat(2, 1fr) !important; 
             gap: 8px !important;
             margin-bottom: 16px !important;
           }
           .ad-calendar-summary-cards .calendar-card {
             padding: 10px 12px !important;
             gap: 10px !important;
             border-radius: 14px !important;
           }
           .ad-calendar-summary-cards .calendar-card > div:first-child {
             width: 36px !important;
             height: 36px !important;
             min-width: 36px !important;
             border-radius: 10px !important;
           }
           .ad-calendar-summary-cards .calendar-card > div:first-child svg {
             width: 18px !important;
             height: 18px !important;
           }
           .ad-calendar-summary-cards .calendar-card div:last-child > div:first-child {
             font-size: 20px !important;
           }
           .ad-calendar-summary-cards .calendar-card div:last-child > div:last-child {
             font-size: 11px !important;
             margin-top: 2px !important;
           }
        }
        .calendar-card {
           background: #ffffff;
           border-radius: 24px;
           box-shadow: 0 4px 20px rgba(0,0,0,0.02);
           border: 1px solid rgba(226, 232, 240, 0.6);
           padding: 24px;
        }

        /* Toolbar Nova - Muito mais leve, limpa e coesa */
        .ad-calendar-toolbar {
          padding: 10px 16px !important;
          margin-bottom: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: wrap !important;
          gap: 12px !important;
          background: #ffffff !important;
          border-radius: 16px !important;
          border: 1px solid rgba(226, 232, 240, 0.8) !important;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.02) !important;
        }
        .ad-calendar-toolbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          flex: 1 1 auto;
          min-width: 0;
        }
        .ad-calendar-toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          flex: 0 0 auto;
        }
        .ad-cal-select {
          height: 38px !important;
          width: auto !important;
          min-width: 140px !important;
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          padding: 0 28px 0 32px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #334155 !important;
          cursor: pointer !important;
          outline: none !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;
          transition: all 0.15s ease !important;
        }
        .ad-cal-select:hover {
          border-color: #cbd5e1 !important;
          background: #f8fafc !important;
        }
        .ad-cal-select:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
        }
        .ad-cal-search-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          width: 190px;
          transition: width 0.2s ease;
        }
        .ad-cal-search-wrap:focus-within {
          width: 230px;
        }
        .ad-cal-search-input {
          height: 38px !important;
          width: 100% !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          padding-left: 32px !important;
          padding-right: 28px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #1e293b !important;
          outline: none !important;
          transition: all 0.15s ease !important;
        }
        .ad-cal-search-input:hover {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
        }
        .ad-cal-search-input:focus {
          background: #ffffff !important;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
        }
        .ad-cal-btn-nav {
          height: 38px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          padding: 0 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .ad-cal-view-toggle {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          border-radius: 10px;
          padding: 3px;
          height: 38px;
        }
        .ad-cal-btn-export {
          height: 38px;
          padding: 0 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          transition: all 0.15s ease;
        }
        .ad-cal-btn-export:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        @media (max-width: 1200px) {
          .ad-calendar-toolbar {
            gap: 12px !important;
          }
          .ad-calendar-toolbar-left,
          .ad-calendar-toolbar-right {
            width: 100%;
            justify-content: flex-start;
          }
        }
        @media (max-width: 640px) {
          .ad-calendar-toolbar { flex-direction: column !important; align-items: stretch !important; padding: 12px !important; }
          .ad-calendar-toolbar-left,
          .ad-calendar-toolbar-right { flex-direction: column !important; align-items: stretch !important; width: 100% !important; }
          .ad-cal-select,
          .ad-cal-search-wrap,
          .ad-cal-btn-nav,
          .ad-cal-view-toggle,
          .ad-cal-btn-export { width: 100% !important; }
          .ad-cal-search-wrap:focus-within { width: 100% !important; }
        }
        /* Custom scrollbar for timeline and lists */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        /* ── Modal Novo/Editar Evento & Visibilidade (Desktop & Mobile) ── */
        .ad-ev-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.72);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          overscroll-behavior: contain;
        }
        .ad-ev-modal-card {
          width: 100%;
          max-width: 560px;
          max-height: 90dvh;
          background: #ffffff;
          border-radius: 26px;
          box-shadow: 0 28px 64px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: auto;
        }
        .ad-ev-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #f1f5f9;
          background: linear-gradient(180deg, #ffffff 0%, #fafbff 100%);
          flex-shrink: 0;
        }
        .ad-ev-modal-close {
          width: 36px;
          height: 36px;
          min-height: 36px !important;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          padding: 0;
          transition: all 0.16s ease;
        }
        .ad-ev-modal-close:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .ad-ev-modal-body {
          padding: 20px 24px;
          overflow-y: auto;
          overscroll-behavior: contain;
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1 1 auto;
        }
        .ad-ev-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 24px 18px;
          border-top: 1px solid #f1f5f9;
          background: #fafbff;
          flex-shrink: 0;
        }
        .ad-ev-field {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .ad-ev-label {
          font-size: 11px;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 5px;
          line-height: 1.2;
        }
        .ad-ev-input {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          height: 44px !important;
          min-height: 44px !important;
          border-radius: 12px !important;
          font-size: 13.5px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          background: #f8fafc !important;
          border: 1.5px solid #e2e8f0 !important;
          padding: 0 12px !important;
          box-sizing: border-box !important;
          transition: all 0.16s ease !important;
        }
        .ad-ev-input:focus {
          background: #ffffff !important;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
          outline: none !important;
        }
        .ad-ev-input:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .ad-ev-select-dot {
          padding-left: 30px !important;
          padding-right: 32px !important;
          cursor: pointer !important;
        }
        .ad-ev-input-icon {
          padding-left: 38px !important;
        }
        .ad-ev-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          width: 100%;
        }
        .ad-ev-allday-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 14px;
          background: #f8fafc;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          cursor: pointer;
          user-select: none;
          transition: all 0.16s ease;
        }
        .ad-ev-allday-card:hover {
          border-color: #cbd5e1;
          background: #f1f5f9;
        }
        .ad-ev-allday-card:has(input:checked) {
          background: rgba(99, 102, 241, 0.06);
          border-color: rgba(99, 102, 241, 0.35);
        }
        .ad-ev-switch-track {
          width: 40px;
          height: 22px;
          border-radius: 999px;
          background: #cbd5e1;
          position: relative;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }
        .ad-ev-allday-card:has(input:checked) .ad-ev-switch-track {
          background: #6366f1;
        }
        .ad-ev-switch-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          position: absolute;
          top: 2px;
          left: 2px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ad-ev-allday-card:has(input:checked) .ad-ev-switch-thumb {
          transform: translateX(18px);
        }
        .ad-ev-vis-box {
          padding: 14px;
          background: #f8fafc;
          border-radius: 18px;
          border: 1.5px solid #e2e8f0;
        }
        .ad-vis-tabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          background: #eef2f6;
          padding: 4px;
          border-radius: 13px;
        }
        .ad-vis-tab-btn {
          min-width: 0;
          padding: 8px 6px;
          border-radius: 10px;
          font-size: 11.5px;
          font-weight: 700;
          background: transparent;
          border: 1px solid transparent;
          color: #64748b;
          cursor: pointer;
          transition: all 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          line-height: 1.2;
          text-align: center;
        }
        .ad-vis-tab-btn:hover {
          color: #334155;
        }
        .ad-vis-tab-btn.active {
          background: #ffffff;
          color: #4f46e5;
          border-color: rgba(99, 102, 241, 0.16);
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
          font-weight: 800;
        }
        .ad-vis-tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ad-vis-label-short {
          display: none;
        }
        .ad-vis-panel-all {
          padding: 12px 14px;
          background: rgba(16, 185, 129, 0.06);
          border-radius: 13px;
          border: 1.5px dashed rgba(16, 185, 129, 0.3);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ad-vis-picker-card {
          width: 100%;
          padding: 11px 13px;
          background: #ffffff;
          border-radius: 13px;
          border: 1.5px solid #e2e8f0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          transition: all 0.16s ease;
          text-align: left;
        }
        .ad-vis-picker-card:hover {
          border-color: #6366f1;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
        }
        .ad-ev-btn-cancel {
          height: 44px !important;
          min-height: 44px !important;
          padding: 0 18px !important;
          border-radius: 12px !important;
          font-size: 13.5px !important;
          font-weight: 700 !important;
          color: #475569 !important;
          background: #ffffff !important;
          border: 1.5px solid #e2e8f0 !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ad-ev-btn-cancel:hover {
          background: #f1f5f9 !important;
          color: #0f172a !important;
        }
        .ad-ev-btn-save {
          height: 44px !important;
          min-height: 44px !important;
          padding: 0 22px !important;
          border-radius: 12px !important;
          font-size: 13.5px !important;
          font-weight: 800 !important;
          color: #ffffff !important;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          border: none !important;
          box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.45) !important;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        @media (max-width: 640px) {
          .ad-ev-modal-overlay {
            padding: 10px;
            align-items: center;
          }
          .ad-ev-modal-card {
            max-height: 92dvh;
            border-radius: 22px;
          }
          .ad-ev-modal-header {
            padding: 15px 16px 13px;
          }
          .ad-ev-modal-body {
            padding: 14px 16px;
            gap: 12px;
          }
          .ad-ev-modal-footer {
            padding: 12px 16px 14px;
            display: grid;
            grid-template-columns: 1fr 1.35fr;
            gap: 8px;
          }
          .ad-ev-btn-cancel,
          .ad-ev-btn-save {
            width: 100% !important;
            height: 42px !important;
            min-height: 42px !important;
            padding: 0 12px !important;
            font-size: 13px !important;
          }
          .ad-ev-input {
            height: 42px !important;
            min-height: 42px !important;
            font-size: 13px !important;
            padding: 0 10px !important;
            border-radius: 11px !important;
          }
          .ad-ev-grid-2 {
            gap: 8px;
          }
          .ad-ev-label {
            font-size: 10.5px;
            margin-bottom: 5px;
          }
          .ad-ev-vis-box {
            padding: 12px;
            border-radius: 15px;
          }
          .ad-vis-tabs {
            gap: 4px;
            padding: 3.5px;
          }
          .ad-vis-tab-btn {
            flex-direction: column;
            gap: 3px;
            padding: 7px 4px;
            font-size: 10.5px;
          }
          .ad-vis-label-full {
            display: none;
          }
          .ad-vis-label-short {
            display: inline;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
        }
        @media (max-width: 345px) {
          .ad-ev-grid-2 {
            grid-template-columns: 1fr;
          }
        }
      `}} />

      {/* 1. Header Interno */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>Calendário Escolar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 500 }}>Gerencie os eventos, aulas e compromissos da instituição.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => { setForm(BLANK_EVENTO); setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos', anoTodos: '' }); setEditingId(null); setShowModal(true) }}
          style={{ background: '#4f46e5', border: 'none', borderRadius: 12, padding: '0 24px', height: 44, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}
        >
          <Plus size={16} /> Novo Evento
        </button>
      </div>

      {/* 2. Resumo em Cards */}
      <div className="ad-calendar-summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
        {[
          { label: 'Eventos do mês', value: resumoMes.total, icon: Calendar, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Hoje', value: eventosPorDia(today).length, icon: Sparkles, color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Próximos 7 dias', value: eventosProximos7DiasCount, icon: Clock, color: '#10b981', bg: '#ecfdf5' },
          { label: 'Aniversários do mês', value: aniversariantes.length, icon: Users, color: '#ec4899', bg: '#fdf2f8' }
        ].map((c, i) => (
          <div key={i} className="calendar-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={24} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginTop: 4 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Barra de Filtros e Controles (Toolbar Reorganizada) */}
      <div className="calendar-card ad-calendar-toolbar">
        
        {/* Esquerda: Filtros e Busca */}
        <div className="ad-calendar-toolbar-left">
          
          <TurmaDropdown 
            turmaOptions={turmaDropdownOptions} 
            selectedTurmaId={filtroTurma === 'todas' ? 'all' : filtroTurma} 
            setSelectedTurmaId={id => setFiltroTurma(id === 'all' ? 'todas' : id)} 
            selectedTurmaName={filtroTurma === 'todas' ? 'Todos os grupos' : filtroTurma}
            anosLetivos={anosLetivos}
            selectedAno={filtroAnoLetivoPrincipal}
            setSelectedAno={ano => { setFiltroAnoLetivoPrincipal(ano); setFiltroTurma('todas'); }}
            icon={<Users size={15} style={{ color: '#4f46e5' }} />}
            buttonStyle={{
              height: 38,
              padding: '0 12px',
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              fontSize: 13,
              fontWeight: 600,
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          />

          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Filter size={14} style={{ position: 'absolute', left: 11, color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
            <select 
              className="ad-cal-select"
              value={filtroTipo} 
              onChange={e => setFiltroTipo(e.target.value as any)}
            >
              <option value="todos">Todos os tipos</option>
              {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 10, color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
          </div>

          <div className="ad-cal-search-wrap">
            <Search size={14} style={{ position: 'absolute', left: 11, color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
            <input 
              type="text" 
              placeholder="Buscar evento..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="ad-cal-search-input"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                title="Limpar busca"
                style={{
                  position: 'absolute',
                  right: 8,
                  zIndex: 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 0
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setFiltroTurma('todas')
                setFiltroTipo('todos')
                setSearchQuery('')
              }}
              title="Limpar todos os filtros"
              style={{
                height: 38,
                padding: '0 10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
              onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
            >
              <X size={13} />
              <span>Limpar</span>
            </button>
          )}

        </div>

        {/* Direita: Controles de Data e View */}
        <div className="ad-calendar-toolbar-right">
          
          {/* Navegação do Mês com Atalho "Hoje" */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                setViewDate(now)
                setSelectedDay(todayStr())
              }}
              title="Ir para o mês e dia de hoje"
              style={{
                height: 38,
                padding: '0 12px',
                background: isCurrentMonth ? '#f8fafc' : '#ffffff',
                border: `1px solid ${isCurrentMonth ? '#e2e8f0' : '#c7d2fe'}`,
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                color: isCurrentMonth ? '#64748b' : '#4f46e5',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f1f5f9'
                if (!isCurrentMonth) e.currentTarget.style.borderColor = '#818cf8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isCurrentMonth ? '#f8fafc' : '#ffffff'
                e.currentTarget.style.borderColor = isCurrentMonth ? '#e2e8f0' : '#c7d2fe'
              }}
            >
              Hoje
            </button>

            <div className="ad-cal-btn-nav">
              <button 
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))} 
                title="Mês anterior"
                style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 7, transition: 'all 0.15s ease' }} 
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} 
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', width: 130, textAlign: 'center', userSelect: 'none', letterSpacing: '-0.01em' }}>
                {MESES[month]} {year}
              </div>
              <button 
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))} 
                title="Próximo mês"
                style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 7, transition: 'all 0.15s ease' }} 
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} 
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Toggle Mês/Semana/Dia */}
          <div className="ad-cal-view-toggle">
            {[
              { id: 'mes', label: 'Mês', icon: Grid },
              { id: 'semana', label: 'Semana', icon: List },
              { id: 'dia', label: 'Dia', icon: Clock }
            ].map(v => {
              const isActive = viewMode === v.id
              return (
                <button 
                  type="button"
                  key={v.id} 
                  onClick={() => setViewMode(v.id as any)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', height: 32,
                    borderRadius: 8, border: 'none', fontSize: 12, fontWeight: isActive ? 700 : 600, cursor: 'pointer',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#4f46e5' : '#64748b',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#1e293b' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#64748b' }}
                >
                  <v.icon size={13} /> <span className="ad-hide-mobile">{v.label}</span>
                </button>
              )
            })}
          </div>

          <button 
            type="button"
            onClick={handleExportEvents}
            title="Exportar eventos deste mês (CSV)"
            className="ad-cal-btn-export"
          >
            <Download size={14} style={{ color: '#64748b' }} /> <span>Exportar</span>
          </button>
          
        </div>
      </div>

      {/* 4. Grade de Conteúdo (3 Colunas) */}
      <div className="ad-calendar-grid-new">
        
        {/* COLUNA 1: Calendário e Banner */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="calendar-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} style={{ color: '#4f46e5' }} /> Calendário Mensal
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
              {DIAS_SEMANA.map((d, i) => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: (i===0 || i===6) ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>{d}</div>)}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 4px' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} style={{ height: 40, color: '#cbd5e1', fontSize: 13, textAlign: 'center', alignSelf: 'center', fontWeight: 500 }}>{getDaysInMonth(year, month-1) - firstDay + i + 1}</div>)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1; const dateStr = getDateStr(d); const events = eventosPorDia(dateStr); const isToday = dateStr === today; const isSelected = dateStr === selectedDay;
                return (
                  <button key={d} onClick={() => setSelectedDay(isSelected ? null : dateStr)} onDoubleClick={() => openNewEventoForDay(dateStr)} 
                    style={{ 
                      height: 44, width: '100%', margin: '0', borderRadius: 12, 
                      background: isSelected ? '#4f46e5' : isToday ? '#eff6ff' : 'transparent', 
                      border: isToday && !isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', position: 'relative'
                    }}
                    onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = isToday ? '#eff6ff' : 'transparent' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: isSelected || isToday ? 800 : 600, color: isSelected ? '#ffffff' : isToday ? '#3b82f6' : '#334155' }}>{d}</div>
                    
                    {events.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, marginTop: 4, position: 'absolute', bottom: 6 }}>
                        {events.slice(0, 3).map(ev => (
                           <div key={ev.id} style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#ffffff' : (ev.cor ?? TIPO_CORES[ev.tipo] ?? '#f59e0b') }} />
                        ))}
                        {events.length > 3 && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#ffffff' : '#94a3b8' }} />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Aulas</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Eventos</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Provas</span></div>
            </div>
          </div>

          <div style={{ borderRadius: 24, padding: 24, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 25px rgba(79, 70, 229, 0.2)' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }}></div>
            <Sparkles size={24} style={{ marginBottom: 12, opacity: 0.9 }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 800 }}>Novo Semestre!</h3>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
              Prepare-se para o novo ciclo acadêmico. Cadastre suas aulas e provas com antecedência.
            </p>
          </div>
        </div>

        {/* COLUNA 2: Dia Selecionado */}
        <div className="calendar-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
          
          {/* Gradiente superior sutil */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '150px', background: 'radial-gradient(ellipse at top center, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

          <div style={{ padding: '32px 32px 16px 32px', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {selectedDay ? ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][new Date(selectedDay + 'T12:00:00').getDay()] : 'Nenhum dia'}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>
              {selectedDay ? `${parseInt(selectedDay.split('-')[2])} de ${MESES[parseInt(selectedDay.split('-')[1]) - 1]} de ${selectedDay.split('-')[0]}` : 'Selecione um dia'}
            </div>
          </div>

          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 100px 32px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
            {selectedEvents.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                 <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                 <p style={{ fontSize: 14, fontWeight: 600 }}>Você tem o dia livre!</p>
                 <p style={{ fontSize: 13, marginTop: 4 }}>Nenhum compromisso agendado para esta data.</p>
               </div>
            ) : (
              selectedEvents.map((ev, idx) => renderEventCard(ev, idx))
            )}
          </div>
          
          {/* Bottom Fade & Actions */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none', zIndex: 2 }}></div>
          <div style={{ position: 'absolute', bottom: 24, left: 32, right: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 3 }}>
             <button style={{ padding: '0 24px', height: 44, borderRadius: 22, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
               Editar
             </button>
             <div style={{ display: 'flex', gap: 12 }}>
               <button style={{ width: 44, height: 44, borderRadius: '50%', background: '#ffffff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', color: '#1e293b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                 <ArrowDown size={20} />
               </button>
               <button style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                 <Upload size={18} />
               </button>
             </div>
          </div>
        </div>

        {/* COLUNA 3: Próximos e Aniversários */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div className="calendar-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: '#10b981' }} /> Próximos Eventos
              </div>
            </div>
            
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {proximosEventos.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>Nenhum evento agendado.</div>
              ) : (
                proximosEventos.map((ev) => {
                  const [y, m, d] = ev.data.split('-')
                  const badgeColor = TIPO_CORES[ev.tipo] || '#cbd5e1'
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: 14, border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'} onClick={() => handleEdit(ev)}>
                      <div style={{ width: 40, height: 44, background: '#ffffff', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>{d}</div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>{MESES[parseInt(m)-1].slice(0,3)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 4 }}>{ev.horaInicio || 'Dia todo'} • {TIPO_LABELS[ev.tipo]}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {proximosEventos.length > 0 && (
              <button style={{ marginTop: 16, width: '100%', padding: '10px', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 10, color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Ver agenda completa
              </button>
            )}
          </div>

          <div 
            className="calendar-card" 
            style={{ 
              padding: 0, 
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 24,
              boxShadow: '0 10px 30px -5px rgba(236, 72, 153, 0.08), 0 4px 16px rgba(0, 0, 0, 0.03)',
              border: '1px solid rgba(244, 114, 182, 0.25)'
            }}
          >
            {/* Cabeçalho com Gradiente Ultra Moderno */}
            <div 
              style={{ 
                background: 'linear-gradient(135deg, #ec4899 0%, #d946ef 45%, #6366f1 100%)',
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(236, 72, 153, 0.2)'
              }}
            >
              {/* Círculos de brilho decorativos de fundo */}
              <div 
                style={{ 
                  position: 'absolute', 
                  top: -24, 
                  right: -24, 
                  width: 90, 
                  height: 90, 
                  borderRadius: '50%', 
                  background: 'radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 70%)', 
                  pointerEvents: 'none' 
                }} 
              />
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: -20, 
                  left: 20, 
                  width: 70, 
                  height: 70, 
                  borderRadius: '50%', 
                  background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)', 
                  pointerEvents: 'none' 
                }} 
              />

              {/* Título com ícone e badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                <div 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 12, 
                    background: 'rgba(255, 255, 255, 0.2)', 
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.35)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    flexShrink: 0
                  }}
                >
                  <Sparkles size={18} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                    Aniversariantes
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginTop: 2 }}>
                    {aniversariantes.length} {aniversariantes.length === 1 ? 'comemoração' : 'comemorações'}
                  </div>
                </div>
              </div>

              {/* Tag com Mês em Glassmorphism */}
              <div 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.22)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  textTransform: 'capitalize',
                  letterSpacing: '0.02em',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {MESES[month]}
              </div>
            </div>
            
            {/* Conteúdo da Lista */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {loadingNivers ? (
                   <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#94a3b8' }}>Buscando aniversariantes...</div>
                ) : aniversariantes.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#94a3b8' }}>Ninguém faz aniversário este mês.</div>
                ) : (
                  aniversariantes.map((p, idx) => {
                    const isHoje = p.dia == hoje.getDate() && month === hoje.getMonth();
                    const subtitulo = p.tipo === 'Aluno' 
                      ? resolveTurmaNomeAluno(p) 
                      : (p.cargo || p.funcao || 'Colaborador');

                    return (
                    <div key={p.id || idx} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ 
                        width: 36, 
                        height: 36, 
                        borderRadius: '50%', 
                        background: p.foto ? `url(${p.foto}) center/cover` : (isHoje ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' : '#f1f5f9'), 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: 12, 
                        fontWeight: 800, 
                        color: isHoje && !p.foto ? '#ffffff' : '#1e293b', 
                        border: isHoje ? '2px solid #ec4899' : '1px solid #e2e8f0', 
                        flexShrink: 0,
                        boxShadow: isHoje ? '0 4px 10px rgba(236, 72, 153, 0.25)' : 'none'
                      }}>
                        {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.nome}
                        </div>
                        <div 
                          title={subtitulo}
                          style={{ 
                            fontSize: 11, 
                            color: isHoje ? '#db2777' : '#64748b', 
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {subtitulo}
                        </div>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        background: isHoje ? 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)' : '#f1f5f9', 
                        borderRadius: 10, 
                        padding: '4px 8px', 
                        color: isHoje ? 'white' : '#64748b', 
                        minWidth: 36,
                        boxShadow: isHoje ? '0 4px 10px rgba(236, 72, 153, 0.25)' : 'none'
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', marginBottom: -2 }}>Dia</span>
                        <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1 }}>{p.dia}</span>
                      </div>
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* MODALS INTACTS (Preserved) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ad-ev-modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowModal(false)
                  setEditingId(null)
                }
              }}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="ad-ev-modal-card"
              >
                {/* Header */}
                <div className="ad-ev-modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: editingId
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(217, 119, 6, 0.08) 100%)'
                          : 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(79, 70, 229, 0.08) 100%)',
                        color: editingId ? '#d97706' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: editingId ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(99, 102, 241, 0.22)'
                      }}
                    >
                      {editingId ? <Edit2 size={18} strokeWidth={2.4} /> : <Calendar size={19} strokeWidth={2.4} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 18, fontFamily: 'Outfit, sans-serif', color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                        {editingId ? 'Editar Evento' : 'Novo Evento'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginTop: 2 }}>
                        Preencha as informações e defina o público-alvo
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar modal"
                    className="ad-ev-modal-close"
                    onClick={() => { setShowModal(false); setEditingId(null) }}
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                </div>

                {/* Body */}
                <div className="ad-ev-modal-body custom-scrollbar">
                  <div className="ad-ev-field">
                    <label className="ad-ev-label">Título do Evento</label>
                    <input
                      className="form-input ad-ev-input"
                      value={form.titulo}
                      onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                      placeholder="Ex: Reunião Pedagógica"
                    />
                  </div>

                  <div className="ad-ev-grid-2">
                    <div className="ad-ev-field">
                      <label className="ad-ev-label">Data Início</label>
                      <input
                        className="form-input ad-ev-input"
                        type="date"
                        value={form.data}
                        onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                      />
                    </div>
                    <div className="ad-ev-field">
                      <label className="ad-ev-label">Data Final (Opc.)</label>
                      <input
                        className="form-input ad-ev-input"
                        type="date"
                        value={form.dataFim || ''}
                        min={form.data}
                        disabled={!!editingId}
                        onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="ad-ev-field">
                    <label className="ad-ev-label">Tipo de Evento</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: 12,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: TIPO_CORES[form.tipo] || '#6366f1',
                          boxShadow: `0 0 0 3px ${(TIPO_CORES[form.tipo] || '#6366f1')}22`,
                          pointerEvents: 'none',
                          zIndex: 1
                        }}
                      />
                      <select
                        className="form-select ad-ev-input ad-ev-select-dot"
                        value={form.tipo}
                        onChange={e => setForm(p => ({ ...p, tipo: e.target.value as any }))}
                      >
                        {Object.entries(TIPO_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label htmlFor="diaTodoApp" className="ad-ev-allday-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: form.diaTodo ? 'rgba(99, 102, 241, 0.14)' : '#e2e8f0', color: form.diaTodo ? '#4f46e5' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.16s ease' }}>
                        <Clock size={15} strokeWidth={2.3} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Evento de Dia Inteiro</div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 1 }}>
                          {form.diaTodo ? 'Sem horário de início ou término específico' : 'Definir horário de início e término'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="diaTodoApp"
                      checked={Boolean(form.diaTodo)}
                      onChange={e => setForm(p => ({ ...p, diaTodo: e.target.checked as any }))}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    />
                    <div className="ad-ev-switch-track">
                      <div className="ad-ev-switch-thumb" />
                    </div>
                  </label>

                  {!form.diaTodo && (
                    <div className="ad-ev-grid-2">
                      <div className="ad-ev-field">
                        <label className="ad-ev-label">Horário Início</label>
                        <input
                          className="form-input ad-ev-input"
                          type="time"
                          value={form.horaInicio}
                          onChange={e => setForm(p => ({ ...p, horaInicio: e.target.value }))}
                        />
                      </div>
                      <div className="ad-ev-field">
                        <label className="ad-ev-label">Horário Término</label>
                        <input
                          className="form-input ad-ev-input"
                          type="time"
                          value={form.horaFim}
                          onChange={e => setForm(p => ({ ...p, horaFim: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="ad-ev-field">
                    <label className="ad-ev-label">Localização / Link</label>
                    <input
                      className="form-input ad-ev-input"
                      value={form.local}
                      onChange={e => setForm(p => ({ ...p, local: e.target.value }))}
                      placeholder="Ex: Auditório, Sala 02 ou Google Meet"
                    />
                  </div>

                  <div className="ad-ev-vis-box">
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Globe size={15} style={{ color: '#6366f1', flexShrink: 0 }} strokeWidth={2.4} />
                      <span style={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
                        Público-alvo e Visibilidade
                      </span>
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

                {/* Footer */}
                <div className="ad-ev-modal-footer">
                  <button
                    type="button"
                    className="ad-ev-btn-cancel"
                    onClick={() => { setShowModal(false); setEditingId(null) }}
                  >
                    Descartar
                  </button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="ad-ev-btn-save"
                    onClick={handleAdd}
                  >
                    <Check size={16} strokeWidth={2.8} />
                    <span>Confirmar e Salvar</span>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* 🎯 Modal de Seleção de Grupos (Equipe Escolar e Turmas) */}
      <SelecionarGruposModal
        isOpen={showSelectionModal.open && showSelectionModal.type === 'turmas'}
        onClose={() => setShowSelectionModal(prev => ({ ...prev, open: false }))}
        selectedGrupos={visibilidade.turmasSel}
        onToggleGrupo={(t) => setVisibilidade(prev => ({
          ...prev,
          turmasSel: prev.turmasSel.includes(t) ? prev.turmasSel.filter(item => item !== t) : [...prev.turmasSel, t]
        }))}
        onChangeSelected={(selected) => setVisibilidade(prev => ({ ...prev, turmasSel: selected }))}
        turmas={turmas}
        grupos={gruposManuais}
        anosLetivos={anosLetivos}
        initialAno={selectedAno || (anosLetivos[0] || '2026')}
      />

      {/* 👤 Modal de Seleção de Usuário Único */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSelectionModal.open && showSelectionModal.type === 'usuario' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ad-ev-modal-overlay"
              style={{ zIndex: 100010 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowSelectionModal({ ...showSelectionModal, open: false })
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 16 }}
                className="ad-ev-modal-card"
                style={{ maxWidth: 460 }}
              >
                <div className="ad-ev-modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={18} strokeWidth={2.3} />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: 0 }}>Selecionar Usuário</h3>
                  </div>
                  <button
                    type="button"
                    className="ad-ev-modal-close"
                    onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })}
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                </div>

                <div className="ad-ev-modal-body custom-scrollbar" style={{ gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      autoFocus
                      className="form-input ad-ev-input ad-ev-input-icon"
                      placeholder="Buscar por nome, cargo ou e-mail..."
                      value={searchTermSelection}
                      onChange={e => setSearchTermSelection(e.target.value)}
                    />
                  </div>

                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                    {usuariosAtivos.filter(u =>
                      (u.nome || '').toLowerCase().includes(searchTermSelection.toLowerCase()) ||
                      (u.cargo || '').toLowerCase().includes(searchTermSelection.toLowerCase()) ||
                      (u.email || '').toLowerCase().includes(searchTermSelection.toLowerCase())
                    ).map(u => {
                      const isSelected = visibilidade.usuario === u.nome
                      return (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          key={u.id}
                          onClick={() => { setVisibilidade(prev => ({ ...prev, usuario: u.nome })); setShowSelectionModal({ ...showSelectionModal, open: false }) }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: isSelected ? '#eff6ff' : '#f8fafc', border: isSelected ? '1.5px solid #93c5fd' : '1.5px solid #f1f5f9', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                        >
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: isSelected ? '#3b82f6' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: isSelected ? '#fff' : '#475569', flexShrink: 0 }}>{(u.nome || 'U').slice(0, 2).toUpperCase()}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: isSelected ? '#1e40af' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nome}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{u.cargo}</div>
                          </div>
                          {isSelected && <Check size={17} color="#3b82f6" strokeWidth={3} />}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <div className="ad-ev-modal-footer">
                  <button
                    type="button"
                    className="ad-ev-btn-save"
                    style={{ width: '100%', flex: '1 1 100%' }}
                    onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })}
                  >
                    <Check size={16} strokeWidth={2.8} />
                    <span>Finalizar Seleção</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
