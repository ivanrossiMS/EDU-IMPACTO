'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useData, EventoAgenda, newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Plus, X, Save, Filter, Users, Globe, UserCheck, Search, Edit2, Sparkles, Check, Calendar as CalendarIcon, Trash2, Clock, MapPin } from 'lucide-react'

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
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
        <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, border: '1.5px dashed rgba(16, 185, 129, 0.2)' }}>
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>🌐 Evento visível para todos os usuários do sistema e aplicativo.</span>
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

const BLANK_EVENTO: Omit<EventoAgenda, 'id' | 'createdAt'> = {
  titulo: '', descricao: '', tipo: 'evento', data: '', horaInicio: '', horaFim: '',
  turmas: [], local: '', cor: '#f59e0b', recorrente: false, criadoPor: 'Usuário',
  confirmacaoNecessaria: false, confirmados: [], unidade: '',
  diaTodo: false,
}

// Caches removidos: utilizando API otimizada de aniversariantes

export default function CalendarioPage() {
  const { eventosAgenda = [], setEventosAgenda, setLocalEventosAgenda } = useData()

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

  const [gruposManuais = []] = useSupabaseArray<{nome: string}>('agenda/grupos')
  const turmasNomes = gruposManuais.map(t => t.nome)
  const [sysUsers] = useLocalStorage<SysUser[]>('edu-sys-users', [])
  const usuariosAtivos = sysUsers.filter(u => u.status === 'ativo')

  const hoje = new Date()
  const [viewDate, setViewDate] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr())
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

  const handleAdd = () => {
    if (!form.titulo.trim() || !form.data) return
    const turmasList = visibilidade.tipo === 'turmas' ? visibilidade.turmasSel
      : visibilidade.tipo === 'todos' ? ['TODOS']
      : []
    
    if (editingId) {
      setEventosAgenda(prev => prev.map(e => e.id === editingId ? {
        ...e,
        ...form,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : { visibilidadeUsuario: undefined }),
      } : e))
    } else {
      const novoEvento: EventoAgenda = {
        ...form,
        cor: TIPO_CORES[form.tipo] ?? '#f59e0b',
        turmas: turmasList,
        id: newId('EV'),
        createdAt: new Date().toISOString(),
        ...(visibilidade.tipo === 'usuario' ? { visibilidadeUsuario: visibilidade.usuario } as any : {}),
      }
      setEventosAgenda(prev => [...prev, novoEvento])
    }
    setForm({ ...BLANK_EVENTO, data: form.data })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' })
    setEditingId(null)
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    setEventosAgenda(prev => prev.filter(e => e.id !== id))
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

    if (rawTurmas && rawTurmas.length > 0 && rawTurmas[0] !== 'TODOS') {
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
        const req = await fetch(`/api/agenda/aniversariantes?mes=${mesView}`)
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

  // Grouped by date for list presentation
  const meventosAgrupados = useMemo(() => {
    const groups: Record<string, typeof meventosNoMes> = {}
    meventosNoMes.forEach(ev => {
      if (!groups[ev.data]) groups[ev.data] = []
      groups[ev.data].push(ev)
    })
    return groups
  }, [meventosNoMes])

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
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container" style={{ minHeight: '100vh', paddingBottom: 100, fontFamily: 'Outfit, sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 992px) {
          .ad-calendar-main-grid { grid-template-columns: 1fr !important; }
        }
      `}} />

      {/* Standard Header Admin */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 28, color: '#1e293b', margin: 0 }}>Gestão do Calendário Escolar</h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0 0' }}>{meventosNoMes.length} evento(s) no mês • {year}</p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button 
            onClick={() => { 
              if (confirm('Tem certeza que deseja EXCLUIR TODOS os eventos do calendário? Esta ação não pode ser desfeita.')) {
                handleDeleteAll();
              }
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 14,
              background: '#fff1f2',
              color: '#ef4444',
              border: '1px solid #fecdd3',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Trash2 size={14} /> Excluir Todos
          </button>

          <button
            onClick={() => { setForm(BLANK_EVENTO); setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' }); setEditingId(null); setShowModal(true) }}
            style={{
              padding: '10px 20px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 20px rgba(99,102,241,0.35)'
            }}
          >
            <Plus size={16} /> Novo Evento
          </button>
        </div>
      </div>

      {/* 📅 FILTRO DO MÊS ALINHADO À ESQUERDA */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '12px 20px',
        marginBottom: 24,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }}>
        {/* Month Switcher Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '6px 10px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            style={{ border: 'none', background: '#fff', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: '#475569' }}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ padding: '0 16px', fontSize: 15, fontWeight: 900, color: '#1e293b', minWidth: 140, textAlign: 'center' }}>
            {MESES[month]} {year}
          </div>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            style={{ border: 'none', background: '#fff', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: '#475569' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 🚀 LAYOUT PRINCIPAL EM LISTA (2 COLUNAS: LISTA DE EVENTOS + CARD DE ANIVERSARIANTES) */}
      <div className="ad-calendar-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        
        {/* 📋 COLUNA ESQUERDA: AGENDA DE EVENTOS EM LISTA TIMELINE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
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
                Nenhum evento encontrado
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 360, margin: '0 auto 20px auto' }}>
                {selectedDay
                  ? 'Não há compromissos agendados para a data selecionada.'
                  : 'Nenhum evento agendado para este mês.'}
              </p>
              {selectedDay && (
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
              )}
            </motion.div>
          ) : (
            /* Timeline List Groups (Matching Reference Image) */
            Object.entries(meventosAgrupados).map(([dateStr, eventsList]) => {
              const [y, m, d] = dateStr.split('-')
              const isToday = dateStr === today
              const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
              const weekDayFull = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })
              const monthAbbr = MESES[parseInt(m) - 1].slice(0, 3).toUpperCase()

              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={dateStr}
                  style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}
                >
                  {/* 🗓️ LEFT DATE CARD */}
                  <div style={{
                    width: 100,
                    minWidth: 100,
                    background: '#fff',
                    borderRadius: 22,
                    padding: '18px 10px',
                    border: isToday ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    boxShadow: isToday ? '0 8px 24px rgba(99,102,241,0.12)' : '0 4px 16px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative'
                  }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: isToday ? '#6366f1' : '#1e293b', lineHeight: 1 }}>
                      {String(parseInt(d)).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: isToday ? '#6366f1' : '#1e293b', marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {monthAbbr}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', marginTop: 2, textTransform: 'uppercase' }}>
                      {weekDayFull}
                    </span>
                    {isToday && (
                      <span style={{ position: 'absolute', top: -10, padding: '2px 8px', background: '#6366f1', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        HOJE
                      </span>
                    )}
                  </div>

                  {/* 📋 RIGHT CONTENT CONTAINER WITH VERTICAL TIMELINE */}
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                    background: '#fff',
                    borderRadius: 22,
                    padding: '20px 24px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {/* Vertical Timeline Line for multiple events */}
                    {eventsList.length > 1 && (
                      <div style={{
                        position: 'absolute',
                        left: 28,
                        top: 32,
                        bottom: 32,
                        width: 3,
                        background: 'linear-gradient(180deg, #f97316 0%, #6366f1 100%)',
                        borderRadius: 2,
                        zIndex: 1
                      }} />
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {eventsList.map((ev, idx) => {
                        const color = ev.cor ?? TIPO_CORES[ev.tipo] ?? '#f97316'
                        return (
                          <div
                            key={ev.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 14,
                              paddingBottom: idx < eventsList.length - 1 ? 14 : 0,
                              borderBottom: idx < eventsList.length - 1 ? '1px solid #f8fafc' : 'none',
                              position: 'relative',
                              zIndex: 2,
                              flexWrap: 'wrap'
                            }}
                          >
                            {/* Vertical Line Node Circle */}
                            {eventsList.length > 1 && (
                              <div style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: '#fff',
                                border: `3px solid ${color}`,
                                flexShrink: 0,
                                margin: '0 4px 0 -2px'
                              }} />
                            )}

                            {/* Time Pill */}
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 14px',
                              borderRadius: 14,
                              background: color + '15',
                              color: color,
                              fontSize: 12,
                              fontWeight: 900,
                              flexShrink: 0
                            }}>
                              <Clock size={13} />
                              <span>{(ev as any).diaTodo ? 'Dia Todo' : ev.horaInicio || '08:00'}</span>
                              {!((ev as any).diaTodo) && ev.horaFim && (
                                <span style={{ opacity: 0.8 }}> - {ev.horaFim}</span>
                              )}
                            </div>

                            {/* Title & Description */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: 14, fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1.3 }}>
                                {ev.titulo}
                              </h4>
                              {ev.descricao && (
                                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0', lineHeight: 1.3 }}>
                                  {ev.descricao}
                                </p>
                              )}
                              {ev.local && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
                                  <MapPin size={11} color={color} />
                                  <span>{ev.local}</span>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons for Admin */}
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(ev as any); }}
                                style={{ width: 32, height: 32, borderRadius: 10, background: '#f1f5f9', border: 'none', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                title="Editar Evento"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (confirm('Excluir evento?')) handleDelete(ev.id); }}
                                style={{ width: 32, height: 32, borderRadius: 10, background: '#fff1f2', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                title="Excluir Evento"
                              >
                                <Trash2 size={14} />
                              </button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* 🎉 CARD DE ANIVERSARIANTES DO MÊS */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: '#fff',
              borderRadius: 24,
              padding: '22px',
              boxShadow: '0 15px 35px rgba(236, 72, 153, 0.08)',
              border: '1px solid rgba(236, 72, 153, 0.15)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Header Decorative Background */}
            <div style={{
              margin: '-22px -22px 18px -22px',
              padding: '18px 22px',
              background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, lineHeight: 1.2 }}>Aniversários do Mês</h3>
                  <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 600 }}>{MESES[month]}</span>
                </div>
              </div>
              <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.25)', borderRadius: 12, fontSize: 12, fontWeight: 900 }}>
                {aniversariantes.length}
              </div>
            </div>

            {/* List of Birthdays */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto', paddingRight: 2 }} className="ad-date-strip-scroll">
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
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 16,
                      background: p.isProximo ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 63, 94, 0.04) 100%)' : '#f8fafc',
                      border: p.isProximo ? '1.5px solid rgba(236, 72, 153, 0.3)' : '1px solid #f1f5f9'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
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
                    }}>
                      {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.nome}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.tipo === 'Aluno' ? (p.turmaNome || (p.turma && !/^\d+$/.test(p.turma) && !/^[0-9a-fA-F-]{10,}$/.test(p.turma) ? p.turma : 'Aluno')) : (p.cargo || p.funcao || p.tipo)}
                      </div>
                    </div>

                    {/* Day Badge */}
                    <div style={{
                      padding: '6px 10px',
                      borderRadius: 12,
                      background: p.isProximo ? '#ec4899' : '#fff',
                      color: p.isProximo ? '#fff' : '#1e293b',
                      border: p.isProximo ? 'none' : '1px solid #e2e8f0',
                      textAlign: 'center',
                      flexShrink: 0,
                      boxShadow: p.isProximo ? '0 6px 12px rgba(236,72,153,0.3)' : 'none'
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' }}>
                        {p.isProximo ? 'É HOJE' : 'DIA'}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>
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
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
            <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="card" style={{ width: '100%', maxWidth: 580, padding: '32px', borderRadius: 32, boxShadow: '0 30px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ fontWeight: 900, fontSize: 20, fontFamily: 'Outfit, sans-serif', color: '#1e293b' }}>{editingId ? '⚡ Editar Evento' : '✨ Novo Evento'}</div>
                <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setEditingId(null); }} style={{ background: '#f1f5f9', borderRadius: '50%' }}><X size={18} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Título do Evento</label>
                  <input className="form-input" style={{ borderRadius: 14, height: 48, fontSize: 14, fontWeight: 600 }} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Reunião Pedagógica" />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Data</label>
                    <input className="form-input" style={{ borderRadius: 14, height: 48 }} type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
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
                    onChangeTipo={(t) => setVisibilidade(prev => ({ ...prev, tipo: t }))} 
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
          </AnimatePresence>
        </ClientPortal>
      )}

      <AnimatePresence>
        {showSelectionModal.open && (
          <ClientPortal>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'none' }}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 460, padding: 32, boxShadow: '0 40px 80px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e293b' }}>{showSelectionModal.type === 'turmas' ? '🎯 Selecionar Grupos' : '👤 Selecionar Usuário'}</h3>
                <button onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })} style={{ border: 'none', background: '#f1f5f9', padding: 8, borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
              </div>
              
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input autoFocus className="form-input" style={{ paddingLeft: 42, height: 50, borderRadius: 16, fontSize: 14, fontWeight: 600, background: '#f8fafc', border: '1.5px solid #e2e8f0' }} placeholder="O que você está procurando?..." value={searchTermSelection} onChange={e => setSearchTermSelection(e.target.value)} />
              </div>

              <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                {showSelectionModal.type === 'turmas' ? (
                  turmasNomes.filter(t => t.toLowerCase().includes(searchTermSelection.toLowerCase())).map(t => {
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
                ) : (
                  usuariosAtivos.filter(u => u.nome.toLowerCase().includes(searchTermSelection.toLowerCase())).map(u => {
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
                )}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 24, height: 50, borderRadius: 16, fontWeight: 900, background: '#1e293b', border: 'none', color: '#fff' }} onClick={() => setShowSelectionModal({ ...showSelectionModal, open: false })}>Finalizar Seleção</button>
            </motion.div>
          </motion.div>
          </ClientPortal>
        )}
      </AnimatePresence>
    </div>
  )
}
