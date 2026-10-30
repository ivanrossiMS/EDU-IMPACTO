'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useData, EventoAgenda, newId } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Plus, X, Save, Filter, Users, Globe, UserCheck, Search, Edit2, Sparkles, Check, Calendar as CalendarIcon, Trash2, Clock, MapPin, Eye, EyeOff } from 'lucide-react'
import { SelecionarGruposModal } from '@/components/agenda/SelecionarGruposModal'

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted ? createPortal(children, document.body) : null;
};

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
  onOpenModal,
  onChangeTipo
}: {
  turmasSel: string[]
  usuarioSel: string
  tipo: 'todos' | 'turmas' | 'usuario'
  onOpenModal: (type: 'turmas' | 'usuario') => void
  onChangeTipo: (tipo: 'todos' | 'turmas' | 'usuario') => void
}) {
  const options = [
    { v: 'todos', label: 'Toda a instituição', shortLabel: 'Instituição', icon: Globe },
    { v: 'turmas', label: 'Grupos específicos', shortLabel: 'Grupos / Turmas', icon: Users },
    { v: 'usuario', label: 'Usuário do sistema', shortLabel: 'Usuário', icon: UserCheck },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Abas de Tipo */}
      <div className="ad-vis-tabs">
        {options.map(opt => {
          const isActive = tipo === opt.v
          const IconComp = opt.icon
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChangeTipo(opt.v)}
              className={`ad-vis-tab-btn ${isActive ? 'active' : ''}`}
            >
              <span className="ad-vis-tab-icon">
                <IconComp size={15} strokeWidth={isActive ? 2.4 : 2} />
              </span>
              <span className="ad-vis-tab-label-desktop">{opt.label}</span>
              <span className="ad-vis-tab-label-mobile">{opt.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Conteúdo Dinâmico */}
      {tipo === 'todos' && (
        <div style={{
          padding: '14px 16px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(5, 150, 105, 0.03) 100%)',
          borderRadius: 14,
          border: '1.5px dashed rgba(16, 185, 129, 0.3)',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}>
          <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, lineHeight: 1.4 }}>
            🌐 Evento visível para todos os usuários do sistema e aplicativo.
          </span>
        </div>
      )}

      {tipo === 'turmas' && (
        <button
          type="button"
          onClick={() => onOpenModal('turmas')}
          className="ad-vis-picker-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: turmasSel.length > 0 ? '#eef2ff' : '#f1f5f9',
              color: turmasSel.length > 0 ? '#4f46e5' : '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Users size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {turmasSel.length === 0 ? 'Nenhum grupo selecionado' : `${turmasSel.length} grupo(s) selecionado(s)`}
              </span>
              <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {turmasSel.length === 0 ? 'Toque para buscar e selecionar turmas ou equipes' : turmasSel.join(', ')}
              </span>
            </div>
          </div>
          <div className="ad-vis-picker-action">
            <Search size={14} />
            <span>Selecionar</span>
          </div>
        </button>
      )}

      {tipo === 'usuario' && (
        <button
          type="button"
          onClick={() => onOpenModal('usuario')}
          className="ad-vis-picker-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: usuarioSel && usuarioSel !== 'Todos' ? '#eef2ff' : '#f1f5f9',
              color: usuarioSel && usuarioSel !== 'Todos' ? '#4f46e5' : '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <UserCheck size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {usuarioSel === 'Todos' || !usuarioSel ? 'Selecionar Usuário' : usuarioSel}
              </span>
              <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {usuarioSel === 'Todos' || !usuarioSel ? 'Toque para buscar um colaborador específico' : 'Usuário destinatário deste evento'}
              </span>
            </div>
          </div>
          <div className="ad-vis-picker-action">
            <Search size={14} />
            <span>Buscar</span>
          </div>
        </button>
      )}
    </div>
  )
}

const BLANK_EVENTO: Omit<EventoAgenda, 'id' | 'createdAt'> = {
  titulo: '', descricao: '', tipo: 'evento', data: '', horaInicio: '', horaFim: '',
  turmas: [], local: '', cor: '#f59e0b', recorrente: false, criadoPor: '',
  confirmacaoNecessaria: false, confirmados: [], unidade: '',
  diaTodo: false,
}

// Caches removidos: utilizando API otimizada de aniversariantes

export default function CalendarioPage() {
  const { currentUser } = useApp()
  const { eventosAgenda = [], setEventosAgenda, setLocalEventosAgenda, turmas = [], cfgCalendarioLetivo = [] } = useData()

  useAgendaRealtime({
    table: 'eventos_agenda',
    toastConfig: {
      enabled: true,
      insertMessage: (doc) => `Novo evento adicionado: ${doc.titulo || 'Sem título'}`,
      updateMessage: (doc) => `Evento atualizado: ${doc.titulo || 'Sem título'}`,
      icon: <CalendarIcon size={18} color="#6366f1" />
    },
    onInsert: ({ new: newEvento }) => {
      if (setLocalEventosAgenda) {
        setLocalEventosAgenda((prev: any) => {
          if (prev.some((p: any) => p.id === newEvento.id)) return prev;
          return [...prev, newEvento];
        });
      }
    },
    onUpdate: ({ new: updatedEvento }) => {
      if (setLocalEventosAgenda) {
        setLocalEventosAgenda((prev: any) => prev.map((p: any) => p.id === updatedEvento.id ? { ...p, ...updatedEvento } : p));
      }
    },
    onDelete: ({ old }) => {
      if (setLocalEventosAgenda) {
        setLocalEventosAgenda((prev: any) => prev.filter((p: any) => p.id !== old?.id));
      }
    }
  });

  const [gruposManuais = []] = useSupabaseArray<any>('agenda/grupos')
  const anosLetivos = useMemo(() => {
    const anos = new Set<string>();
    (cfgCalendarioLetivo || []).forEach((c: any) => c.ano && anos.add(String(c.ano)));
    (turmas || []).forEach((t: any) => {
      if (t.ano) anos.add(String(t.ano));
      if (t.ano_letivo) anos.add(String(t.ano_letivo));
    });
    return Array.from(anos).sort().reverse();
  }, [turmas, cfgCalendarioLetivo])

  const turmasNomes = gruposManuais.map((t: any) => t.nome)
  const [sysUsers] = useLocalStorage<SysUser[]>('edu-sys-users', [])
  const usuariosAtivos = sysUsers.filter(u => u.status === 'ativo')

  const hoje = new Date()
  const [viewDate, setViewDate] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showSelectionModal, setShowSelectionModal] = useState<{ open: boolean, type: 'turmas' | 'usuario' }>({ open: false, type: 'turmas' })
  const [searchTermSelection, setSearchTermSelection] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<EventoAgenda, 'id' | 'createdAt'>>(BLANK_EVENTO)

  const [visibilidade, setVisibilidade] = useState<{ tipo: 'todos' | 'turmas' | 'usuario'; turmasSel: string[]; usuario: string }>({
    tipo: 'todos', turmasSel: [], usuario: 'Todos',
  })

  const [filtroTurma, setFiltroTurma] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | 'todos'>('todos')
  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [mostrarTodos, setMostrarTodos] = useState(false)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = todayStr()

  const getDateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const eventosFiltrados = useMemo(() => eventosAgenda.filter(e => {
    const matchTurma = filtroTurma === 'todas' || (e.turmas ?? []).includes(filtroTurma) || (e.turmas ?? []).length === 0
    const matchTipo = filtroTipo === 'todos' || e.tipo === filtroTipo
    const matchUsuario = filtroUsuario === 'todos' || (e as any).visibilidadeUsuario === filtroUsuario || (e as any).visibilidadeUsuario === undefined
    return matchTurma && matchTipo && matchUsuario
  }), [eventosAgenda, filtroTurma, filtroTipo, filtroUsuario])

  const eventosPorDia = (dateStr: string) => eventosFiltrados.filter(e => e.data === dateStr)
  const selectedEvents = selectedDay ? eventosPorDia(selectedDay) : []

  const handleAdd = async () => {
    if (!form.titulo.trim() || !form.data) return
    const turmasList = visibilidade.tipo === 'turmas' ? visibilidade.turmasSel
      : visibilidade.tipo === 'todos' ? ['TODOS']
      : []
    
    if (editingId) {
      const existingEv = eventosAgenda.find(e => e.id === editingId)
      const updatedEvento: EventoAgenda = {
        ...(existingEv || ({} as any)),
        ...form,
        id: editingId,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : { visibilidadeUsuario: undefined }),
      }
      if (setLocalEventosAgenda) {
        setLocalEventosAgenda(prev => prev.map(e => e.id === editingId ? updatedEvento : e))
      } else {
        setEventosAgenda(prev => prev.map(e => e.id === editingId ? updatedEvento : e))
      }
      fetch('/api/agenda/eventos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEvento),
      }).catch(err => console.error('[Calendario Admin] Erro ao atualizar evento:', err))
    } else {
      const creatorName =
        form.criadoPor && form.criadoPor !== 'Usuário'
          ? form.criadoPor
          : (currentUser?.nome || '')
      const novoEvento: EventoAgenda = {
        ...form,
        criadoPor: creatorName,
        usuarioId: currentUser?.id || undefined,
        usuarioNome: creatorName || undefined,
        usuarioCargo: currentUser?.cargo || currentUser?.perfil || undefined,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        id: newId('EV'),
        createdAt: new Date().toISOString(),
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : {}),
      } as any
      if (setLocalEventosAgenda) {
        setLocalEventosAgenda(prev => [...prev, novoEvento])
      } else {
        setEventosAgenda(prev => [...prev, novoEvento])
      }
      fetch('/api/agenda/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([novoEvento]),
      }).catch(err => console.error('[Calendario Admin] Erro ao salvar novo evento:', err))
    }
    setForm({ ...BLANK_EVENTO, data: form.data })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' })
    setEditingId(null)
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    if (setLocalEventosAgenda) {
      setLocalEventosAgenda(prev => prev.filter(e => e.id !== id))
    }
    try {
      const res = await fetch(`/api/agenda/eventos?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        console.error('[Calendario Admin] Erro ao excluir no servidor:', await res.text())
      }
    } catch (err) {
      console.error('[Calendario Admin] Erro de rede ao excluir evento:', err)
    }
  }

  const handleDeleteAll = async () => {
    try {
      const res = await fetch('/api/agenda/eventos', { method: 'DELETE' });
      if (res.ok) {
        setEventosAgenda([]);
        if (setLocalEventosAgenda) setLocalEventosAgenda([]);
      } else {
        alert('Erro ao excluir eventos.');
      }
    } catch (e) {
      alert('Erro de conexão ao excluir eventos.');
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

    let rawTurmas: any = ev.turmas || []
    if (typeof rawTurmas === 'string') {
      try { rawTurmas = JSON.parse(rawTurmas) } catch(e) { rawTurmas = [rawTurmas] }
    }
    if (!Array.isArray(rawTurmas)) rawTurmas = []

    if (rawTurmas && rawTurmas.length > 0 && !String(rawTurmas[0]).toUpperCase().startsWith('TODOS')) {
      t = 'turmas';
      turmasSel = rawTurmas;
    } else if ((ev as any).visibilidadeUsuario) {
      t = 'usuario';
      usuarioStr = (ev as any).visibilidadeUsuario;
    }

    setVisibilidade({ tipo: t as any, turmasSel, usuario: usuarioStr })
    setEditingId(ev.id)
    setShowModal(true)
  }

  const openNewEventoForDay = (dateStr: string) => {
    setForm({ ...BLANK_EVENTO, data: dateStr })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' })
    setEditingId(null)
    setShowModal(true)
  }

  const proximosEventos = eventosAgenda
    .filter(e => e.data > today)
    .sort((a, b) => (a.data + a.horaInicio) < (b.data + b.horaInicio) ? -1 : 1)
    .slice(0, 5)

  const [aniversariantes, setAniversariantes] = useState<any[]>([])
  const [loadingNivers, setLoadingNivers] = useState(false)
  const niversCacheRef = useRef<Record<number, any[]>>({})

  const getAdminTurmaDisplayName = (p: any): string => {
    if (p.tipo !== 'Aluno') return p.cargo || p.funcao || p.tipo || 'Colaborador'
    const candidate = String(p.turmaNome || p.turma_nome || '').trim()
    if (candidate && !/^\d+$/.test(candidate) && !/^[0-9a-fA-F-]{10,}$/.test(candidate) && candidate.toLowerCase() !== 'sync' && candidate.toLowerCase() !== 'aluno') {
      return candidate
    }
    const rawTurma = String(p.turma || '').trim()
    if (Array.isArray(turmas) && turmas.length > 0) {
      const tObj: any = turmas.find((t: any) => t && (
        String(t.id).trim() === rawTurma ||
        String(t.codigo || '').trim() === rawTurma ||
        String(t.dados?.codigo || '').trim() === rawTurma ||
        String(t.id).trim() === candidate ||
        String(t.codigo || '').trim() === candidate
      ))
      if (tObj?.nome && !/^\d+$/.test(String(tObj.nome).trim())) return String(tObj.nome).trim()
      if (tObj?.dados?.nome && !/^\d+$/.test(String(tObj.dados.nome).trim())) return String(tObj.dados.nome).trim()
    }
    return 'Aluno'
  }

  useEffect(() => {
    const mesView = month + 1

    if (niversCacheRef.current[mesView]) {
      setAniversariantes(niversCacheRef.current[mesView])
      setLoadingNivers(false)
      return
    }

    let isCancelled = false
    const fetchNivers = async () => {
      setLoadingNivers(true)
      try {
        const req = await fetch(`/api/agenda/aniversariantes?mes=${mesView}&_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
        if (!req.ok) throw new Error('Falha ao buscar aniversariantes')
        const todos = await req.json()
        if (isCancelled) return

        const niversMes = (todos || []).filter((p: any) => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          if (!data) return false
          let m = -1
          if (data.includes('-')) m = parseInt(data.split('-')[1])
          else if (data.includes('/')) m = parseInt(data.split('/')[1])
          return m === mesView
        }).map((p: any) => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          let dia = -1
          if (data.includes('-')) dia = parseInt(data.split('-')[2])
          else if (data.includes('/')) dia = parseInt(data.split('/')[0])
          
          let isProximo = false
          if (mesView === (hoje.getMonth() + 1)) {
            const diaHoje = hoje.getDate()
            isProximo = dia === diaHoje
          }
          return { ...p, dia, isProximo }
        }).sort((a: any, b: any) => a.dia - b.dia)

        if (!isCancelled) {
          niversCacheRef.current[mesView] = niversMes
          setAniversariantes(niversMes)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!isCancelled) setLoadingNivers(false)
      }
    }

    fetchNivers()
    return () => { isCancelled = true }
  }, [month])

  const [searchQuery, setSearchQuery] = useState('')

  // Events of the selected month filtered by search and type
  const meventosNoMes = useMemo(() => {
    return (eventosAgenda || [])
      .filter(e => {
        if (!e.data) return false
        const [y, m] = e.data.split('-')
        return parseInt(y) === year && parseInt(m) === month + 1
      })
      .filter(e => {
        if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          e.titulo?.toLowerCase().includes(q) ||
          e.local?.toLowerCase().includes(q) ||
          e.descricao?.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.data + (a.horaInicio || '')).localeCompare(b.data + (b.horaInicio || '')))
  }, [eventosAgenda, year, month, filtroTipo, searchQuery])

  const eventosPassadosCount = useMemo(() => {
    return meventosNoMes.filter(e => e.data < today).length
  }, [meventosNoMes, today])

  const eventosVisiveisNoMes = useMemo(() => {
    if (mostrarTodos) return meventosNoMes
    return meventosNoMes.filter(e => e.data >= today)
  }, [meventosNoMes, mostrarTodos, today])

  // Grouped by date for list presentation
  const meventosAgrupados = useMemo(() => {
    const groups: Record<string, typeof meventosNoMes> = {}
    eventosVisiveisNoMes.forEach(ev => {
      if (!groups[ev.data]) groups[ev.data] = []
      groups[ev.data].push(ev)
    })
    return groups
  }, [eventosVisiveisNoMes])

  const tiposList: Array<{ id: TipoEvento | 'todos'; label: string; color: string }> = [
    { id: 'todos', label: 'Todos os eventos', color: '#6366f1' },
    { id: 'prova', label: 'Provas & Testes', color: '#ef4444' },
    { id: 'aula', label: 'Aulas', color: '#3b82f6' },
    { id: 'evento', label: 'Eventos', color: '#f59e0b' },
    { id: 'reuniao', label: 'Reuniões', color: '#8b5cf6' },
    { id: 'feriado', label: 'Feriados', color: '#6b7280' },
    { id: 'excursao', label: 'Excursões', color: '#10b981' },
    { id: 'entrega', label: 'Entregas', color: '#06b6d4' },
    { id: 'atividade', label: 'Atividades', color: '#ec4899' },
  ]

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container" style={{ minHeight: '100vh', paddingBottom: 130, fontFamily: 'Outfit, sans-serif', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-calendar-header {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-calendar-main-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 360px !important;
          gap: 24px !important;
          align-items: start !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-calendar-events-col,
        .ad-calendar-birthdays-col {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-calendar-timeline-row {
          display: flex !important;
          gap: 14px !important;
          align-items: stretch !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-calendar-date-card {
          width: 82px !important;
          min-width: 82px !important;
          max-width: 82px !important;
          flex-shrink: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-calendar-event-card {
          flex: 1 1 0% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        .ad-calendar-birthdays-card {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        @media (max-width: 992px) {
          .ad-calendar-main-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 20px !important;
          }
        }
        @media (max-width: 640px) {
          .ad-calendar-header-main {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .ad-calendar-actions-wrap {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .ad-calendar-timeline-row {
            gap: 10px !important;
          }
          .ad-calendar-date-card {
            width: 68px !important;
            min-width: 68px !important;
            max-width: 68px !important;
            padding: 10px 4px !important;
            border-radius: 16px !important;
          }
          .ad-calendar-day-num {
            font-size: 22px !important;
          }
          .ad-calendar-event-card {
            padding: 12px 14px !important;
            border-radius: 16px !important;
          }
          .ad-calendar-birthdays-card {
            padding: 16px !important;
            border-radius: 20px !important;
          }
          .ad-calendar-birthdays-header {
            margin: -16px -16px 14px -16px !important;
            padding: 12px 16px !important;
          }
          .ad-calendar-birthday-item {
            padding: 8px 10px !important;
            gap: 8px !important;
          }
          .ad-calendar-birthday-avatar {
            width: 38px !important;
            height: 38px !important;
            font-size: 11px !important;
          }
          .ad-calendar-birthday-daybadge {
            padding: 4px 8px !important;
            border-radius: 10px !important;
          }
          .ad-calendar-birthday-daybadge-num {
            font-size: 13px !important;
          }
        }

        /* ── Modal Novo / Editar Evento (Desktop & Mobile) ── */
        .ad-ev-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          background: rgba(15, 23, 42, 0.72) !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          z-index: 100000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 20px !important;
          overflow: hidden !important;
          overscroll-behavior: contain !important;
          box-sizing: border-box !important;
        }
        .ad-ev-modal-card {
          background: #ffffff !important;
          border-radius: 24px !important;
          width: 100% !important;
          max-width: 560px !important;
          max-height: min(88dvh, 760px) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          box-shadow: 0 28px 64px -12px rgba(15, 23, 42, 0.38), 0 0 0 1px rgba(226, 232, 240, 0.85) !important;
          box-sizing: border-box !important;
          min-width: 0 !important;
          font-family: 'Outfit', sans-serif !important;
        }
        .ad-ev-modal-header {
          padding: 18px 22px !important;
          background: #ffffff !important;
          border-bottom: 1px solid #f1f5f9 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          flex-shrink: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-ev-modal-close {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          padding: 0 !important;
          border-radius: 12px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          color: #64748b !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          flex-shrink: 0 !important;
          transition: all 0.18s ease !important;
        }
        .ad-ev-modal-close:hover:not(:disabled) {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
        }
        .ad-ev-modal-body {
          padding: 20px 22px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .ad-ev-modal-footer {
          padding: 14px 22px !important;
          background: #f8fafc !important;
          border-top: 1px solid #e2e8f0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 10px !important;
          flex-shrink: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .ad-ev-field {
          display: flex !important;
          flex-direction: column !important;
          min-width: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .ad-ev-label {
          display: flex !important;
          align-items: center !important;
          gap: 5px !important;
          font-family: 'Outfit', sans-serif !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          color: #475569 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          margin: 0 0 6px 0 !important;
          line-height: 1.2 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .ad-ev-input,
        .ad-ev-select {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          height: 44px !important;
          min-height: 44px !important;
          padding: 0 12px !important;
          border-radius: 12px !important;
          border: 1.5px solid #e2e8f0 !important;
          background: #f8fafc !important;
          color: #0f172a !important;
          font-family: 'Outfit', 'Inter', sans-serif !important;
          font-size: 13.5px !important;
          font-weight: 600 !important;
          transition: all 0.18s ease !important;
          outline: none !important;
          margin: 0 !important;
        }
        .ad-ev-select.ad-ev-select-dot {
          padding-left: 32px !important;
        }
        .ad-ev-input.ad-ev-input-icon {
          padding-left: 34px !important;
        }
        .ad-ev-input::placeholder {
          color: #94a3b8 !important;
          font-weight: 500 !important;
        }
        .ad-ev-input:focus,
        .ad-ev-select:focus {
          background: #ffffff !important;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3.5px rgba(99, 102, 241, 0.14) !important;
        }
        .ad-ev-input:disabled,
        .ad-ev-select:disabled {
          opacity: 0.55 !important;
          cursor: not-allowed !important;
          background: #f1f5f9 !important;
        }
        .ad-ev-grid-2 {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 12px !important;
          width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-ev-allday-card {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          padding: 11px 14px !important;
          background: #f8fafc !important;
          border-radius: 14px !important;
          border: 1.5px solid #e2e8f0 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .ad-ev-allday-card:hover {
          border-color: #cbd5e1 !important;
          background: #f1f5f9 !important;
        }
        .ad-ev-allday-card:has(input:checked) {
          background: #eef2ff !important;
          border-color: #818cf8 !important;
          box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08) !important;
        }
        .ad-ev-switch-track {
          width: 40px !important;
          height: 22px !important;
          border-radius: 999px !important;
          background: #cbd5e1 !important;
          position: relative !important;
          transition: background 0.2s ease !important;
          flex-shrink: 0 !important;
        }
        .ad-ev-switch-thumb {
          width: 18px !important;
          height: 18px !important;
          border-radius: 50% !important;
          background: #ffffff !important;
          position: absolute !important;
          top: 2px !important;
          left: 2px !important;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
        }
        .ad-ev-allday-card:has(input:checked) .ad-ev-switch-track {
          background: #6366f1 !important;
        }
        .ad-ev-allday-card:has(input:checked) .ad-ev-switch-thumb {
          transform: translateX(18px) !important;
        }

        /* ── Visibilidade Selector Tabs & Picker Cards ── */
        .ad-vis-tabs {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 6px !important;
          background: #eef2f6 !important;
          padding: 5px !important;
          border-radius: 14px !important;
          border: 1px solid #e2e8f0 !important;
          width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }
        .ad-vis-tab-btn {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 5px !important;
          padding: 9px 6px !important;
          border-radius: 10px !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          color: #64748b !important;
          cursor: pointer !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          min-width: 0 !important;
          width: 100% !important;
          min-height: 56px !important;
          box-sizing: border-box !important;
          text-align: center !important;
          font-family: 'Outfit', sans-serif !important;
          font-size: 11.5px !important;
          font-weight: 700 !important;
          line-height: 1.15 !important;
        }
        .ad-vis-tab-btn:hover:not(.active) {
          background: rgba(255, 255, 255, 0.5) !important;
          color: #334155 !important;
        }
        .ad-vis-tab-btn.active {
          background: #ffffff !important;
          color: #4f46e5 !important;
          border-color: rgba(99, 102, 241, 0.24) !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06) !important;
        }
        .ad-vis-tab-icon {
          width: 26px !important;
          height: 26px !important;
          border-radius: 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: rgba(100, 116, 139, 0.1) !important;
          color: #64748b !important;
          transition: all 0.2s ease !important;
          flex-shrink: 0 !important;
        }
        .ad-vis-tab-btn.active .ad-vis-tab-icon {
          background: #eef2ff !important;
          color: #4f46e5 !important;
        }
        .ad-vis-tab-label-desktop {
          display: block !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 100% !important;
        }
        .ad-vis-tab-label-mobile {
          display: none !important;
        }
        .ad-vis-picker-card {
          width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          padding: 10px 12px !important;
          background: #ffffff !important;
          border-radius: 12px !important;
          border: 1.5px solid #e2e8f0 !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          transition: all 0.18s ease !important;
          font-family: 'Outfit', sans-serif !important;
        }
        .ad-vis-picker-card:hover {
          border-color: #818cf8 !important;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08) !important;
        }
        .ad-vis-picker-action {
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
          padding: 6px 10px !important;
          border-radius: 9px !important;
          background: #eef2ff !important;
          color: #4f46e5 !important;
          font-size: 11.5px !important;
          font-weight: 800 !important;
          flex-shrink: 0 !important;
        }
        .ad-ev-btn-cancel {
          height: 44px !important;
          min-height: 44px !important;
          padding: 0 20px !important;
          border-radius: 12px !important;
          font-family: 'Outfit', sans-serif !important;
          font-size: 13.5px !important;
          font-weight: 700 !important;
          background: #ffffff !important;
          color: #475569 !important;
          border: 1.5px solid #e2e8f0 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.18s ease !important;
        }
        .ad-ev-btn-cancel:hover {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
        }
        .ad-ev-btn-submit {
          height: 44px !important;
          min-height: 44px !important;
          padding: 0 24px !important;
          border-radius: 12px !important;
          font-family: 'Outfit', sans-serif !important;
          font-size: 13.5px !important;
          font-weight: 800 !important;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          color: #ffffff !important;
          border: none !important;
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.28) !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          transition: all 0.18s ease !important;
        }

        @media (max-width: 640px) {
          .ad-ev-modal-overlay {
            padding: 10px !important;
          }
          .ad-ev-modal-card {
            border-radius: 22px !important;
            max-height: 90dvh !important;
          }
          .ad-ev-modal-header {
            padding: 14px 16px !important;
          }
          .ad-ev-modal-body {
            padding: 16px !important;
            gap: 14px !important;
          }
          .ad-ev-modal-footer {
            padding: 12px 16px !important;
          }
          .ad-ev-btn-cancel {
            flex: 1 1 0% !important;
            padding: 0 12px !important;
          }
          .ad-ev-btn-submit {
            flex: 1.4 1 0% !important;
            padding: 0 14px !important;
          }
          .ad-ev-grid-2 {
            gap: 10px !important;
          }
          .ad-ev-input,
          .ad-ev-select {
            height: 42px !important;
            min-height: 42px !important;
            font-size: 13px !important;
            padding: 0 10px !important;
            border-radius: 11px !important;
          }
          .ad-ev-select.ad-ev-select-dot {
            padding-left: 30px !important;
          }
          .ad-ev-input.ad-ev-input-icon {
            padding-left: 34px !important;
          }
          .ad-ev-label {
            font-size: 10.5px !important;
            letter-spacing: 0.04em !important;
            margin-bottom: 5px !important;
          }
          .ad-vis-tab-btn {
            padding: 8px 4px !important;
            min-height: 52px !important;
            font-size: 11px !important;
          }
          .ad-vis-tab-label-desktop {
            display: none !important;
          }
          .ad-vis-tab-label-mobile {
            display: block !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 100% !important;
          }
          .ad-vis-picker-action span {
            display: none !important;
          }
          .ad-vis-picker-action {
            padding: 7px !important;
          }
        }
        @media (max-width: 345px) {
          .ad-ev-grid-2 {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}} />

      {/* Standard Header Admin */}
      <div className="ad-calendar-header" style={{ marginBottom: 20 }}>
        <div className="ad-calendar-header-main" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 'clamp(22px, 3.5vw, 28px)', color: '#0f172a', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Gestão do Calendário Escolar
            </h1>
            <p className="page-subtitle" style={{ color: '#64748b', fontSize: 13, fontWeight: 500, margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
              <span>
                {!mostrarTodos && eventosPassadosCount > 0
                  ? `${eventosVisiveisNoMes.length} próximo(s) • ${meventosNoMes.length} evento(s) no mês • ${year}`
                  : `${meventosNoMes.length} evento(s) no mês • ${year}`}
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="ad-calendar-actions-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button 
              onClick={() => { 
                if (confirm('Tem certeza que deseja EXCLUIR TODOS os eventos do calendário? Esta ação não pode ser desfeita.')) {
                  handleDeleteAll();
                }
              }}
              style={{
                height: 44,
                padding: '0 16px',
                borderRadius: 14,
                background: '#fff1f2',
                color: '#ef4444',
                border: '1px solid #fecdd3',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Trash2 size={14} /> <span>Excluir Todos</span>
            </button>

            <button
              onClick={() => { setForm(BLANK_EVENTO); setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' }); setEditingId(null); setShowModal(true) }}
              style={{
                height: 44,
                padding: '0 18px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff',
                border: 'none',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(99,102,241,0.28)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={16} strokeWidth={2.5} /> <span>Novo Evento</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📅 BARRA DO MÊS CENTRALIZADA */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '10px 16px',
        marginBottom: 20,
        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
        position: 'relative'
      }}>
        {/* Month Switcher Controls */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#f8fafc',
          padding: '5px 8px',
          borderRadius: 16,
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            style={{
              border: 'none',
              background: '#fff',
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              color: '#475569',
              transition: 'all 0.15s ease'
            }}
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div style={{
            padding: '0 14px',
            fontSize: 15,
            fontWeight: 700,
            color: '#0f172a',
            minWidth: 140,
            textAlign: 'center',
            letterSpacing: '-0.01em',
            fontFamily: 'Outfit, sans-serif'
          }}>
            {MESES[month]} {year}
          </div>

          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            style={{
              border: 'none',
              background: '#fff',
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              color: '#475569',
              transition: 'all 0.15s ease'
            }}
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>

          {(hoje.getFullYear() !== year || hoje.getMonth() !== month) && (
            <button
              onClick={() => setViewDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
              style={{
                marginLeft: 4,
                padding: '4px 10px',
                borderRadius: 10,
                background: '#e0e7ff',
                color: '#4338ca',
                fontSize: 11.5,
                fontWeight: 700,
                border: '1px solid #c7d2fe',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Voltar para o mês atual"
            >
              Hoje
            </button>
          )}
        </div>

        {/* Botão Mostrar Todos / Ocultar Passados */}
        <button
          type="button"
          onClick={() => setMostrarTodos(prev => !prev)}
          style={{
            height: 46,
            padding: '0 16px',
            borderRadius: 16,
            background: mostrarTodos
              ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
              : '#f8fafc',
            color: mostrarTodos ? '#ffffff' : '#4f46e5',
            border: mostrarTodos ? '1px solid #4f46e5' : '1px solid #e2e8f0',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'Outfit, sans-serif',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: mostrarTodos
              ? '0 4px 12px rgba(99, 102, 241, 0.25)'
              : '0 1px 3px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box'
          }}
          title={mostrarTodos ? 'Ocultar eventos que já passaram' : 'Mostrar todos os eventos do mês (incluindo realizados)'}
        >
          {mostrarTodos ? <EyeOff size={15} /> : <Eye size={15} />}
          <span>{mostrarTodos ? 'Ocultar passados' : 'Mostrar todos'}</span>
          {eventosPassadosCount > 0 && (
            <span style={{
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: mostrarTodos ? 'rgba(255, 255, 255, 0.22)' : 'rgba(99, 102, 241, 0.12)',
              color: mostrarTodos ? '#ffffff' : '#4f46e5',
              lineHeight: 1.2
            }}>
              {meventosNoMes.length}
            </span>
          )}
        </button>
      </div>

      {/* 🚀 LAYOUT PRINCIPAL EM LISTA (2 COLUNAS: LISTA DE EVENTOS + CARD DE ANIVERSARIANTES) */}
      <div className="ad-calendar-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24, alignItems: 'start', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        
        {/* 📋 COLUNA ESQUERDA: AGENDA DE EVENTOS EM LISTA TIMELINE */}
        <div className="ad-calendar-events-col" style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          
          {Object.keys(meventosAgrupados).length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: '60px 24px',
                textAlign: 'center',
                border: '1px solid #f1f5f9',
                boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px auto', color: '#4338ca'
              }}>
                <CalendarIcon size={36} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e293b', margin: '0 0 6px 0' }}>
                {!mostrarTodos && eventosPassadosCount > 0
                  ? 'Não há próximos eventos neste mês'
                  : 'Nenhum evento encontrado'}
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 380, margin: '0 auto 20px auto' }}>
                {!mostrarTodos && eventosPassadosCount > 0
                  ? `Os ${eventosPassadosCount} evento(s) agendado(s) para ${MESES[month]} já foram realizados.`
                  : selectedDay
                    ? 'Não há compromissos agendados para a data selecionada.'
                    : 'Nenhum evento agendado para este mês.'}
              </p>
              {!mostrarTodos && eventosPassadosCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setMostrarTodos(true)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 8px 16px rgba(99,102,241,0.25)'
                  }}
                >
                  <Eye size={15} />
                  <span>Mostrar todos ({meventosNoMes.length})</span>
                </button>
              ) : selectedDay ? (
                <button
                  onClick={() => setSelectedDay(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 14,
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(99,102,241,0.25)'
                  }}
                >
                  Ver Todos os Eventos do Mês
                </button>
              ) : null}
            </motion.div>
          ) : (
            /* Timeline List Groups (Matching Reference Image) */
            Object.entries(meventosAgrupados).map(([dateStr, eventsList]) => {
              const [y, m, d] = dateStr.split('-')
              const isToday = dateStr === today
              const isPast = dateStr < today
              const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
              const weekDayShort = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
              const monthAbbr = MESES[parseInt(m) - 1].slice(0, 3).toUpperCase()

              const resolveRealColor = (evItem: any) => {
                const raw = evItem?.cor ?? TIPO_CORES[evItem?.tipo as TipoEvento] ?? '#6366f1'
                return String(raw).toLowerCase() === '#6b7280' ? '#06b6d4' : raw
              }
              const primaryColor = isPast ? '#94a3b8' : resolveRealColor(eventsList[0])
              const dateAccentColor = isPast ? '#94a3b8' : (isToday ? '#6366f1' : primaryColor)

              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={dateStr}
                  className="ad-calendar-timeline-row"
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'stretch',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    opacity: isPast ? 0.72 : 1,
                    filter: isPast ? 'grayscale(0.65)' : 'none',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {/* 🗓️ LEFT DATE CARD */}
                  <div 
                    className="ad-calendar-date-card"
                    style={{
                      width: 82,
                      minWidth: 82,
                      maxWidth: 82,
                      background: isPast
                        ? '#f1f5f9'
                        : isToday
                          ? 'linear-gradient(145deg, #6366f1 0%, #4f46e5 100%)'
                          : '#ffffff',
                      borderRadius: 20,
                      padding: '16px 8px',
                      border: isPast
                        ? '1px solid #e2e8f0'
                        : isToday
                          ? '1px solid #4f46e5'
                          : '1px solid #e2e8f0',
                      boxShadow: isPast
                        ? 'none'
                        : isToday
                          ? '0 8px 20px -4px rgba(79, 70, 229, 0.38)'
                          : '0 4px 14px rgba(15, 23, 42, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative',
                      boxSizing: 'border-box'
                    }}
                  >
                    {isToday && (
                      <span style={{
                        position: 'absolute',
                        top: -9,
                        padding: '2px 9px',
                        background: '#ffffff',
                        color: '#4f46e5',
                        border: '1.5px solid #6366f1',
                        borderRadius: 10,
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                        boxShadow: '0 2px 8px rgba(79, 70, 229, 0.22)'
                      }}>
                        HOJE
                      </span>
                    )}
                    <span 
                      className="ad-calendar-day-num"
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: isPast ? '#64748b' : isToday ? '#ffffff' : '#0f172a',
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                        fontFamily: 'Outfit, sans-serif'
                      }}
                    >
                      {String(parseInt(d)).padStart(2, '0')}
                    </span>
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: isPast ? '#94a3b8' : isToday ? 'rgba(255, 255, 255, 0.92)' : primaryColor,
                      marginTop: 4,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}>
                      {monthAbbr}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: isPast ? '#94a3b8' : isToday ? 'rgba(255, 255, 255, 0.75)' : '#64748b',
                      marginTop: 2,
                      textTransform: 'uppercase'
                    }}>
                      {weekDayShort}
                    </span>
                  </div>

                  {/* 📋 RIGHT CONTENT CONTAINER */}
                  <div 
                    className="ad-calendar-event-card"
                    style={{
                      flex: '1 1 0%',
                      minWidth: 0,
                      maxWidth: '100%',
                      background: isPast
                        ? '#f8fafc'
                        : isToday
                          ? 'linear-gradient(135deg, #ffffff 0%, #f5f7ff 100%)'
                          : '#ffffff',
                      borderRadius: 20,
                      padding: '16px 20px',
                      border: isPast
                        ? '1px solid #e2e8f0'
                        : isToday
                          ? '1.5px solid rgba(99, 102, 241, 0.38)'
                          : '1px solid #e2e8f0',
                      boxShadow: isPast
                        ? 'none'
                        : isToday
                          ? '0 0 0 4px rgba(99, 102, 241, 0.08), 0 10px 26px -6px rgba(79, 70, 229, 0.14)'
                          : '0 4px 16px rgba(15, 23, 42, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'relative',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                      {eventsList.map((ev, idx) => {
                        const color = isPast ? '#64748b' : resolveRealColor(ev)
                        return (
                          <div
                            key={ev.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              paddingBottom: idx < eventsList.length - 1 ? 14 : 0,
                              borderBottom: idx < eventsList.length - 1 ? '1px solid #f1f5f9' : 'none',
                              position: 'relative',
                              zIndex: 2
                            }}
                          >
                            {/* Top Row: Time Badge + Edit/Delete Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {eventsList.length > 1 && (
                                  <div style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: color,
                                    flexShrink: 0
                                  }} />
                                )}

                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '4px 10px',
                                  borderRadius: 10,
                                  background: isPast ? '#e2e8f0' : `${color}14`,
                                  color: isPast ? '#64748b' : color,
                                  border: isPast ? '1px solid #cbd5e1' : `1px solid ${color}35`,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  letterSpacing: '0.01em'
                                }}>
                                  <Clock size={12} strokeWidth={2.2} />
                                  <span>{(ev as any).diaTodo ? 'Dia Todo' : ev.horaInicio || '08:00'}</span>
                                  {!((ev as any).diaTodo) && ev.horaFim && (
                                    <span style={{ opacity: 0.8 }}> - {ev.horaFim}</span>
                                  )}
                                </div>

                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: 999,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  background: isPast ? '#f1f5f9' : (isToday ? '#eef2ff' : `${color}12`),
                                  color: isPast ? '#64748b' : (isToday ? '#4f46e5' : color),
                                  border: isPast ? '1px solid #cbd5e1' : (isToday ? '1px solid #c7d2fe' : `1px solid ${color}35`)
                                }}>
                                  {isPast ? 'Realizado' : (isToday ? 'Hoje' : TIPO_LABELS[ev.tipo] || 'Próximo')}
                                </span>
                              </div>

                              {/* Action Buttons for Admin */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEdit(ev as any); }}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 9,
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    color: '#4f46e5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Editar Evento"
                                >
                                  <Edit2 size={13} strokeWidth={2} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (confirm('Excluir evento?')) handleDelete(ev.id); }}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 9,
                                    background: '#fff1f2',
                                    border: '1px solid #fecdd3',
                                    color: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Excluir Evento"
                                >
                                  <Trash2 size={13} strokeWidth={2} />
                                </button>
                              </div>
                            </div>

                            {/* Title & Description: Full width for fluid readability */}
                            <div>
                              <h4 style={{
                                fontSize: 14.5,
                                fontWeight: isPast ? 600 : 800,
                                color: isPast ? '#64748b' : '#0f172a',
                                margin: 0,
                                lineHeight: 1.4,
                                letterSpacing: '-0.01em',
                                wordBreak: 'break-word'
                              }}>
                                {ev.titulo}
                              </h4>
                              {ev.descricao && (
                                <p style={{
                                  fontSize: 12.5,
                                  color: isPast ? '#94a3b8' : '#475569',
                                  margin: '3px 0 0 0',
                                  lineHeight: 1.45,
                                  fontWeight: 400
                                }}>
                                  {ev.descricao}
                                </p>
                              )}
                              {ev.local && (
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: isPast ? '#94a3b8' : '#475569',
                                  marginTop: 4
                                }}>
                                  <MapPin size={12} color={color} />
                                  <span>{ev.local}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}

        </div>

        {/* 🎈 COLUNA DIREITA: APENAS O CARD DE ANIVERSARIANTES DO MÊS */}
        <div className="ad-calendar-birthdays-col" style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          
          {/* 🎉 CARD DE ANIVERSARIANTES DO MÊS */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ad-calendar-birthdays-card"
            style={{
              background: '#fff',
              borderRadius: 24,
              padding: '22px',
              boxShadow: '0 15px 35px rgba(236, 72, 153, 0.08)',
              border: '1px solid rgba(236, 72, 153, 0.15)',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            {/* Header Decorative Background */}
            <div 
              className="ad-calendar-birthdays-header"
              style={{
                margin: '-22px -22px 18px -22px',
                padding: '18px 22px',
                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Aniversários do Mês</h3>
                  <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 600 }}>{MESES[month]}</span>
                </div>
              </div>
              <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.25)', borderRadius: 12, fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                {aniversariantes.length}
              </div>
            </div>

            {/* List of Birthdays */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto', paddingRight: 2, width: '100%', minWidth: 0, boxSizing: 'border-box' }} className="ad-date-strip-scroll">
              {loadingNivers ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#94a3b8' }}>Carregando aniversariantes...</div>
              ) : aniversariantes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🎈</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Nenhum aniversariante neste mês</div>
                </div>
              ) : (
                aniversariantes.map((p, idx) => (
                  <motion.div
                    whileHover={{ x: 4 }}
                    key={p.id || idx}
                    className="ad-calendar-birthday-item"
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 16,
                      background: p.isProximo ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 63, 94, 0.04) 100%)' : '#f8fafc',
                      border: p.isProximo ? '1.5px solid rgba(236, 72, 153, 0.3)' : '1px solid #f1f5f9',
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Avatar */}
                    <div 
                      className="ad-calendar-birthday-avatar"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: p.foto ? `url(${p.foto}) center/cover` : 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 900,
                        boxShadow: '0 4px 10px rgba(236, 72, 153, 0.2)',
                        border: p.isProximo ? '2px solid #ec4899' : '2px solid #fff'
                      }}
                    >
                      {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.nome}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getAdminTurmaDisplayName(p)}
                      </div>
                    </div>

                    {/* Day Badge */}
                    <div 
                      className="ad-calendar-birthday-daybadge"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 12,
                        background: p.isProximo ? '#ec4899' : '#fff',
                        color: p.isProximo ? '#fff' : '#1e293b',
                        border: p.isProximo ? 'none' : '1px solid #e2e8f0',
                        textAlign: 'center',
                        flexShrink: 0,
                        boxShadow: p.isProximo ? '0 6px 12px rgba(236,72,153,0.3)' : 'none'
                      }}
                    >
                      <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' }}>
                        {p.isProximo ? 'É HOJE' : 'DIA'}
                      </div>
                      <div className="ad-calendar-birthday-daybadge-num" style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>
                        {p.dia}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

        </div>

      </div>

      {showModal && (
        <ClientPortal>
          <AnimatePresence>
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
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 12 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="ad-ev-modal-card"
              >
                {/* ── Sticky Header ── */}
                <div className="ad-ev-modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                      border: '1px solid #c7d2fe',
                      color: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.14)'
                    }}>
                      {editingId ? <Edit2 size={17} strokeWidth={2.3} /> : <Sparkles size={18} strokeWidth={2.3} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h2 style={{
                        fontWeight: 800,
                        fontSize: 'clamp(17px, 2.5vw, 19px)',
                        fontFamily: 'Outfit, sans-serif',
                        color: '#0f172a',
                        margin: 0,
                        lineHeight: 1.2,
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {editingId ? 'Editar Evento' : 'Novo Evento'}
                      </h2>
                      <p style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: '#64748b',
                        margin: '2px 0 0 0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        Preencha os detalhes para agendar no calendário
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar modal"
                    className="ad-ev-modal-close"
                    onClick={() => { setShowModal(false); setEditingId(null); }}
                  >
                    <X size={18} strokeWidth={2.2} />
                  </button>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="ad-ev-modal-body">
                  <div className="ad-ev-field">
                    <label htmlFor="admin-ev-titulo" className="ad-ev-label">
                      Título do Evento
                    </label>
                    <input
                      id="admin-ev-titulo"
                      name="titulo"
                      type="text"
                      className="ad-ev-input"
                      value={form.titulo}
                      onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                      placeholder="Ex: Reunião Pedagógica"
                    />
                  </div>

                  <div className="ad-ev-grid-2">
                    <div className="ad-ev-field">
                      <label htmlFor="admin-ev-data" className="ad-ev-label">
                        Data
                      </label>
                      <input
                        id="admin-ev-data"
                        name="data"
                        className="ad-ev-input"
                        type="date"
                        value={form.data}
                        onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                      />
                    </div>
                    <div className="ad-ev-field">
                      <label htmlFor="admin-ev-tipo" className="ad-ev-label">
                        Tipo
                      </label>
                      <div style={{ position: 'relative', width: '100%', minWidth: 0 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: 13,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: TIPO_CORES[form.tipo] ?? '#f59e0b',
                            boxShadow: `0 0 8px ${(TIPO_CORES[form.tipo] ?? '#f59e0b')}80`,
                            pointerEvents: 'none',
                            zIndex: 2
                          }}
                        />
                        <select
                          id="admin-ev-tipo"
                          name="tipo"
                          className="ad-ev-select ad-ev-select-dot"
                          style={{ cursor: 'pointer' }}
                          value={form.tipo}
                          onChange={e => setForm(p => ({ ...p, tipo: e.target.value as any }))}
                        >
                          {Object.entries(TIPO_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <label htmlFor="diaTodo" className="ad-ev-allday-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: form.diaTodo ? '#e0e7ff' : '#e2e8f0',
                        color: form.diaTodo ? '#4f46e5' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s ease'
                      }}>
                        <Clock size={16} strokeWidth={2.2} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                          Evento de Dia Inteiro
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 1 }}>
                          {form.diaTodo ? 'Marcado como duração de dia todo' : 'Definir horário de início e término'}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="diaTodo"
                      checked={Boolean(form.diaTodo)}
                      onChange={e => setForm(p => ({ ...p, diaTodo: e.target.checked as any }))}
                      style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                    />
                    <div className="ad-ev-switch-track" aria-hidden="true">
                      <div className="ad-ev-switch-thumb" />
                    </div>
                  </label>

                  {!form.diaTodo && (
                    <div className="ad-ev-grid-2">
                      <div className="ad-ev-field">
                        <label htmlFor="admin-ev-hora-inicio" className="ad-ev-label">
                          Horário Início
                        </label>
                        <input
                          id="admin-ev-hora-inicio"
                          name="horaInicio"
                          className="ad-ev-input"
                          type="time"
                          value={form.horaInicio}
                          onChange={e => setForm(p => ({ ...p, horaInicio: e.target.value }))}
                        />
                      </div>
                      <div className="ad-ev-field">
                        <label htmlFor="admin-ev-hora-fim" className="ad-ev-label">
                          Horário Término
                        </label>
                        <input
                          id="admin-ev-hora-fim"
                          name="horaFim"
                          className="ad-ev-input"
                          type="time"
                          value={form.horaFim}
                          onChange={e => setForm(p => ({ ...p, horaFim: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="ad-ev-field">
                    <label htmlFor="admin-ev-local" className="ad-ev-label">
                      Localização / Link
                    </label>
                    <div style={{ position: 'relative', width: '100%', minWidth: 0 }}>
                      <MapPin
                        size={15}
                        style={{
                          position: 'absolute',
                          left: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                          zIndex: 2
                        }}
                      />
                      <input
                        id="admin-ev-local"
                        name="local"
                        type="text"
                        className="ad-ev-input ad-ev-input-icon"
                        value={form.local}
                        onChange={e => setForm(p => ({ ...p, local: e.target.value }))}
                        placeholder="Ex: Auditório, Sala 02 ou Google Meet"
                      />
                    </div>
                  </div>

                  <div style={{
                    padding: '14px',
                    background: '#f8fafc',
                    borderRadius: 18,
                    border: '1.5px solid #e2e8f0',
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        background: '#eef2ff',
                        color: '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Globe size={13} strokeWidth={2.4} />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
                        Público-alvo e Visibilidade
                      </span>
                    </div>
                    <VisibilidadeSelector
                      tipo={visibilidade.tipo}
                      turmasSel={visibilidade.turmasSel}
                      usuarioSel={visibilidade.usuario}
                      onChangeTipo={(t) => setVisibilidade(prev => ({ ...prev, tipo: t }))}
                      onOpenModal={(type) => setShowSelectionModal({ open: true, type })}
                    />
                  </div>
                </div>

                {/* ── Sticky Footer ── */}
                <div className="ad-ev-modal-footer">
                  <button
                    type="button"
                    className="ad-ev-btn-cancel"
                    onClick={() => { setShowModal(false); setEditingId(null); }}
                  >
                    Descartar
                  </button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="ad-ev-btn-submit"
                    onClick={handleAdd}
                  >
                    <Check size={16} strokeWidth={2.6} />
                    <span>Confirmar e Salvar</span>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </ClientPortal>
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
        initialAno={anosLetivos[0] || '2026'}
      />

      {/* 👤 Modal de Seleção de Usuário Único */}
      <AnimatePresence>
        {showSelectionModal.open && showSelectionModal.type === 'usuario' && (
          <ClientPortal>
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
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="ad-ev-modal-card"
                style={{ maxWidth: 460 }}
              >
                <div className="ad-ev-modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={17} />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>Selecionar Usuário</h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar seleção de usuário"
                    className="ad-ev-modal-close"
                    onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="ad-ev-modal-body" style={{ gap: 12 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', zIndex: 2 }} />
                    <input
                      autoFocus
                      type="text"
                      className="ad-ev-input ad-ev-input-icon"
                      placeholder="Buscar usuário pelo nome..."
                      value={searchTermSelection}
                      onChange={e => setSearchTermSelection(e.target.value)}
                    />
                  </div>

                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                    {usuariosAtivos.filter(u => u.nome.toLowerCase().includes(searchTermSelection.toLowerCase())).map(u => {
                      const isSelected = visibilidade.usuario === u.nome
                      return (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          key={u.id}
                          onClick={() => { setVisibilidade(prev => ({ ...prev, usuario: u.nome })); setShowSelectionModal({ ...showSelectionModal, open: false }) }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            textAlign: 'left',
                            background: isSelected ? '#eef2ff' : '#f8fafc',
                            border: `1.5px solid ${isSelected ? '#6366f1' : '#f1f5f9'}`,
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: isSelected ? '#4f46e5' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: isSelected ? '#fff' : '#475569', flexShrink: 0 }}>
                            {u.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: isSelected ? '#312e81' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.nome}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.cargo}
                            </div>
                          </div>
                          {isSelected && <Check size={17} color="#4f46e5" strokeWidth={2.8} />}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <div className="ad-ev-modal-footer">
                  <button
                    type="button"
                    className="ad-ev-btn-submit"
                    style={{ width: '100%', flex: '1 1 100%' }}
                    onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })}
                  >
                    <Check size={16} strokeWidth={2.6} />
                    <span>Finalizar Seleção</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </ClientPortal>
        )}
      </AnimatePresence>
    </div>
  )
}
