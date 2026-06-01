'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData, EventoAgenda, newId } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import React, { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Filter, Calendar, Sparkles, Smile, Star, Heart, Camera, Clock, MapPin, Loader2, Plus, Users, Globe, Edit2, Trash2, X, Upload, Search, UserCheck, Check } from 'lucide-react'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { TurmaDropdown } from '../components/TurmaDropdown'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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

interface SysUser { id: string; nome: string; email: string; cargo: string; perfil: string; status: 'ativo' | 'inativo'; twofa: boolean; ultimoAcesso: string }

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

const BLANK_EVENTO: Omit<EventoAgenda, 'id' | 'createdAt'> & { dataFim?: string } = {
  titulo: '', descricao: '', tipo: 'evento', data: '', horaInicio: '', horaFim: '',
  turmas: [], local: '', cor: '#f59e0b', recorrente: false, criadoPor: 'Usuário',
  confirmacaoNecessaria: false, confirmados: [], unidade: '',
  diaTodo: false, dataFim: ''
}

export default function ADCalendarioPage() {
  const [eventosAgenda, setEventosAgenda, { setLocal: setLocalEventos }] = useSupabaseArray<EventoAgenda>('agenda/eventos')
  const [turmas] = useSupabaseArray<any>('turmas')

  useAgendaRealtime({
    table: 'eventos_agenda',
    toastConfig: {
      enabled: true,
      insertMessage: (doc) => `Novo evento: ${doc.titulo || 'Sem título'}`,
      updateMessage: (doc) => `Evento atualizado: ${doc.titulo || 'Sem título'}`,
      icon: <Calendar size={18} color="#6366f1" />
    },
    onInsert: ({ new: newEvento }) => {
      if (setLocalEventos) {
        setLocalEventos((prev: any) => {
          if (prev.some((p: any) => p.id === newEvento.id)) return prev;
          return [...prev, newEvento];
        });
      }
    },
    onUpdate: ({ new: updatedEvento }) => {
      if (setLocalEventos) {
        setLocalEventos((prev: any) => prev.map((p: any) => p.id === updatedEvento.id ? { ...p, ...updatedEvento } : p));
      }
    },
    onDelete: ({ old }) => {
      if (setLocalEventos) {
        setLocalEventos((prev: any) => prev.filter((p: any) => p.id !== old?.id));
      }
    }
  });
  
  const { currentUser } = useApp()
  const [sysUsers] = useLocalStorage<SysUser[]>('edu-sys-users', [])
  const usuariosAtivos = sysUsers.filter(u => u.status === 'ativo')
  const turmasNomes = turmas.map((t: any) => t.nome)

  const { chatGroups = [] } = useAgendaDigital()
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')

  const turmaOptions = React.useMemo(() => {
    if (!currentUser?.id) return [];
    
    const userGroups = (chatGroups || []).filter(g => {
      let colabs = g.colaboradoresIds;
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
      }
      if (!Array.isArray(colabs)) colabs = [];
      return colabs.some(id => String(id) === String(currentUser.id));
    });

    const isGlobal = userGroups.some(g => g.isGlobalAccess === true);
    if (isGlobal) return turmas;

    const accessibleTurmas = turmas.filter(t => {
       return userGroups.some(g => String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase())
    });
    return accessibleTurmas
  }, [turmas, chatGroups, currentUser])

  useEffect(() => {
    if (selectedTurmaId === 'all' && turmaOptions.length > 0) {
      setSelectedTurmaId(turmaOptions[0].id)
    }
  }, [turmaOptions, selectedTurmaId])

  const selectedTurmaName = React.useMemo(() => {
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? t.nome : 'Selecione uma turma'
  }, [selectedTurmaId, turmas])

  const activeTurmas = React.useMemo(() => {
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? [t] : []
  }, [selectedTurmaId, turmaOptions, turmas])

      
  
    
  
  const hoje = new Date()
  const [viewDate, setViewDate] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoEvento | 'todos'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [showSelectionModal, setShowSelectionModal] = useState<{ open: boolean, type: 'turmas' | 'usuario' }>({ open: false, type: 'turmas' })
  const [searchTermSelection, setSearchTermSelection] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<EventoAgenda, 'id' | 'createdAt'> & { dataFim?: string }>(BLANK_EVENTO)

  const [visibilidade, setVisibilidade] = useState<{ tipo: 'todos' | 'turmas' | 'usuario'; turmasSel: string[]; usuario: string }>({
    tipo: 'todos', turmasSel: [], usuario: 'Todos',
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = todayStr()

  const getDateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Filter events targeted to this student's class
  
  const eventosFiltrados = useMemo(() => {
    return (eventosAgenda || []).filter(e => {
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false

      let targets: any = e.turmas || []
      if (typeof targets === 'string') {
        try { targets = JSON.parse(targets) } catch(err) { targets = [targets] }
      }
      if (!Array.isArray(targets)) targets = []
      
      if (targets.some((t: string) => t.toLowerCase() === 'todos' || t.toLowerCase() === 'toda a escola' || t.toLowerCase() === 'todas')) {
        return true
      }
      
      return targets.some((tc: string) => {
        const tcl = tc.toLowerCase()
        return activeTurmas.some(at => 
          tcl.includes(at.nome.toLowerCase()) || 
          at.nome.toLowerCase().includes(tcl)
        )
      })
    })
  }, [eventosAgenda, filtroTipo, activeTurmas])


  const eventosPorDia = (dateStr: string) => eventosFiltrados.filter(e => e.data === dateStr)
  const selectedEvents = selectedDay ? eventosPorDia(selectedDay) : []

  const handleAdd = () => {
    if (!form.titulo.trim() || !form.data) return
    const turmasList = visibilidade.tipo === 'turmas' ? visibilidade.turmasSel
      : visibilidade.tipo === 'todos' ? ['TODOS']
      : []
    
    if (editingId) {
      setEventosAgenda((prev: any) => prev.map((e: any) => e.id === editingId ? {
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
      setEventosAgenda((prev: any) => [...prev, ...novosEventos])
    }
    setForm({ ...BLANK_EVENTO, data: form.data })
    setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' })
    setEditingId(null)
    setShowModal(false)
  }

  const handleDelete = (id: string) => setEventosAgenda((prev: any) => prev.filter((e: any) => e.id !== id))

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

    if (ev.turmas && ev.turmas.length > 0 && ev.turmas[0] !== 'TODOS') {
      t = 'turmas';
      turmasSel = ev.turmas;
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

  const proximosEventos = eventosFiltrados
    .filter(e => e.data >= today)
    .sort((a, b) => (a.data + a.horaInicio) < (b.data + b.horaInicio) ? -1 : 1)
    .slice(0, 5)

  const [aniversariantes, setAniversariantes] = useState<any[]>([])
  const [loadingNivers, setLoadingNivers] = useState(false)

  useEffect(() => {
    const fetchNivers = async () => {
      setLoadingNivers(true)
      try {
        const [resAlunos, resProfs] = await Promise.all([
          fetch('/api/alunos?limit=2000').then(r => r.json()),
          fetch('/api/funcionarios?limit=500').then(r => r.json())
        ])
        const todos = [
          ...(resAlunos.data || []).map((a: any) => ({ ...a, tipo: 'Aluno' })),
          ...(resProfs.data || []).map((p: any) => ({ ...p, tipo: 'Colaborador' }))
        ]
        const mesView = month + 1
        
        // Filter birthdays only for peers in the SAME CLASS or teachers
        const niversMes = todos.filter(p => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          if (!data) return false
          const m = parseInt(data.split('-')[1])
          if (m !== mesView) return false
          
          if (p.tipo === 'Aluno') {
            const pTurmaRaw = p.turma || ''
            const pTurmaObj = turmas.find((t: any) => String(t.id) === String(pTurmaRaw) || String(t.codigo) === String(pTurmaRaw) || String(t.nome) === String(pTurmaRaw))
            const pNomeTurma = pTurmaObj?.nome || p.turma_nome || pTurmaRaw
            const pNomeTurmaLimpo = String(pNomeTurma).split('-')[0].trim()
            
            return activeTurmas.some(at => at.nome.toLowerCase() === pNomeTurmaLimpo.toLowerCase())

          }
          return true // Keep teachers visible
        }).map(p => {
          const data = p.dataNasc || p.data_nascimento || p.nascimento
          const dia = parseInt(data.split('-')[2])
          let isProximo = false
          if (mesView === (hoje.getMonth() + 1)) {
            const diaHoje = hoje.getDate()
            isProximo = dia >= diaHoje && dia <= (diaHoje + 7)
          }
          return { ...p, dia, isProximo }
        }).sort((a, b) => a.dia - b.dia)
        setAniversariantes(niversMes)
      } catch (e) { console.error(e) } finally { setLoadingNivers(false) }
    }
    fetchNivers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, activeTurmas])

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-calendar-mobile-container" style={{ minHeight: '100vh', paddingBottom: 40 }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
           .ad-calendar-mobile-container .page-header { align-items: center !important; text-align: center !important; flex-direction: column !important; gap: 12px !important; }
           .ad-calendar-filter-bar { flex-direction: column !important; align-items: stretch !important; padding: 16px !important; }
           .ad-calendar-grid-columns { grid-template-columns: 1fr !important; }
           .ad-calendar-bottom-panels { grid-template-columns: 1fr !important; }
        }
      `}} />

      {/* Header aligned perfectly with the admin design */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 28, color: '#1e293b', margin: 0 }}>Calendário Escolar</h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0 0' }}>{eventosFiltrados.length} evento(s) da turma • {year}</p>
        </div>
        <div className="ad-calendar-badge" style={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 50, gap: 12 }}>
          <button 
            className="btn btn-primary" 
            style={{ height: 40, padding: '0 16px', borderRadius: 12, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => {
              setForm({ ...BLANK_EVENTO, data: todayStr() })
              setVisibilidade({ tipo: 'todos', turmasSel: [], usuario: 'Todos' })
              setEditingId(null)
              setShowModal(true)
            }}
          >
            <Plus size={16} /> <span>Novo Evento</span>
          </button>
          <TurmaDropdown 
            turmaOptions={turmaOptions} 
            selectedTurmaId={selectedTurmaId} 
            setSelectedTurmaId={setSelectedTurmaId} 
            selectedTurmaName={selectedTurmaName} 
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ad-calendar-filter-bar" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
        <Filter size={13} style={{ color: 'hsl(var(--text-muted))' }} />
        <select className="form-input" style={{ width: 'auto', fontSize: 12, minWidth: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Main Two-Column Calendar Grid */}
      <div className="ad-calendar-grid-columns" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* Left Column: Month Selector Calendar Card */}
        <div className="card" style={{ padding: '16px', borderRadius: 20, boxShadow: '0 4px 15px rgba(0,0,0,0.02)', background: '#fff', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{MESES[month]} {year}</div>
            <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 10 }}>
            {DIAS_SEMANA.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const dateStr = getDateStr(d)
              const events = eventosPorDia(dateStr)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDay
              return (
                <button key={d} onClick={() => setSelectedDay(isSelected ? null : dateStr)} style={{ height: 42, borderRadius: 12, background: isSelected ? '#6366f1' : 'transparent', border: `1px solid ${isSelected ? '#6366f1' : isToday ? '#e2e8f0' : 'transparent'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: isSelected || isToday ? 800 : 500, color: isSelected ? '#fff' : isToday ? '#6366f1' : '#334155' }}>{d}</div>
                  <div style={{ display: 'flex', gap: 2 }}>{isSelected ? <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} /> : events.slice(0, 3).map(ev => <div key={ev.id} style={{ width: 4, height: 4, borderRadius: '50%', background: ev.cor ?? TIPO_CORES[ev.tipo] }} />)}</div>
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Right Column: Events and Birthday sub-panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4, scrollbarWidth: 'none' }}>
          
          {/* 📍 Events of the selected day Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="card" 
            style={{ 
              padding: '24px', borderRadius: 28, border: '1px solid rgba(255,255,255,0.8)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.04)',
              position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(99, 102, 241, 0.03)', borderRadius: '50%' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                   <Calendar size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>
                    {selectedDay ? `${parseInt(selectedDay.split('-')[2])} de ${MESES[parseInt(selectedDay.split('-')[1]) - 1]}` : 'Agenda do Dia'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{selectedEvents.length} compromisso(s)</div>
                </div>
              </div>
            </div>

            {selectedEvents.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>☁️</div>
                <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{selectedDay ? 'Nenhum evento para este dia' : 'Selecione um dia no calendário'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedEvents.map((ev, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                    key={ev.id} 
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: (ev.cor ?? TIPO_CORES[ev.tipo]) + '08',
                      borderRadius: 12,
                      border: `1px solid ${(ev.cor ?? TIPO_CORES[ev.tipo]) + '15'}`,
                      marginBottom: idx === selectedEvents.length - 1 ? 0 : 8,
                      gap: 16
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                      {/* Event Color Dot */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.cor ?? TIPO_CORES[ev.tipo], flexShrink: 0 }} />
                      
                      {/* Time */}
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', background: '#f8fafc', padding: '4px 8px', borderRadius: 6, minWidth: 100, textAlign: 'center', flexShrink: 0 }}>
                        {(ev as any).diaTodo ? '☀️ Dia Todo' : `${ev.horaInicio || '00:00'}${ev.horaFim ? ` - ${ev.horaFim}` : ''}`}
                      </span>

                      {/* Title & Local */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</span>
                          <span style={{ fontSize: 10, fontWeight: 900, color: ev.cor ?? TIPO_CORES[ev.tipo], textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
                            {TIPO_LABELS[ev.tipo]}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                          {ev.local && (
                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={11} /> <span>{ev.local}</span>
                            </div>
                          )}
                          {ev.descricao && (
                            <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', paddingLeft: 15 }}>
                              {ev.descricao}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Admin Controls */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" style={{ width: 32, height: 32, color: '#64748b' }} onClick={(e) => { e.stopPropagation(); handleEdit(ev as any) }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon" style={{ width: 32, height: 32, color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); if(confirm('Excluir evento?')) handleDelete(ev.id) }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Birthdays and Upcoming Side-by-Side Panels */}
          <div className="ad-calendar-bottom-panels" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            
            {/* 🎉 Birthdays Panel */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="card" style={{ padding: '20px', borderRadius: 28, background: '#fff', boxShadow: '0 15px 35px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Sparkles size={16} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>Aniversários do Mês</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {loadingNivers ? (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#94a3b8' }}>Buscando...</div>
                ) : aniversariantes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: 11, color: '#94a3b8' }}>Ninguém este mês 🎈</div>
                ) : (
                  aniversariantes.map((p, idx) => (
                    <motion.div 
                      whileHover={{ x: 5 }}
                      key={p.id || idx}
                      style={{ 
                        display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', 
                        borderRadius: 22, background: p.isProximo ? 'rgba(236, 72, 153, 0.04)' : '#f8fafc',
                        border: p.isProximo ? '1.5px solid rgba(236, 72, 153, 0.15)' : '1.5px solid transparent',
                        boxShadow: p.isProximo ? '0 8px 20px rgba(236, 72, 153, 0.05)' : 'none'
                      }}
                    >
                      <div style={{ 
                        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                        background: p.foto ? `url(${p.foto}) center/cover` : '#fff',
                        border: p.isProximo ? '2.5px solid #ec4899' : '2.5px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#64748b',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                      }}>
                        {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Outfit, sans-serif' }}>{p.nome}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{p.tipo}</div>
                      </div>

                      <div style={{ 
                        width: 54, height: 54, borderRadius: 18, flexShrink: 0,
                        background: p.isProximo ? '#ec4899' : '#fff',
                        border: p.isProximo ? 'none' : '1.5px solid #e2e8f0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        boxShadow: p.isProximo ? '0 10px 20px rgba(236, 72, 153, 0.25)' : '0 4px 10px rgba(0,0,0,0.03)'
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: p.isProximo ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Dia</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: p.isProximo ? '#fff' : '#1e293b', lineHeight: 1 }}>{p.dia}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* 📅 Upcoming Events Panel */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="card" style={{ padding: '20px', borderRadius: 28, background: '#fff', boxShadow: '0 15px 35px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Calendar size={16} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>Próximos Compromissos</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {proximosEventos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: 11, color: '#94a3b8' }}>Sem eventos futuros</div>
                ) : (
                  proximosEventos.map((ev, idx) => {
                    const [y, m, d] = ev.data.split('-')
                    return (
                      <motion.div 
                        whileHover={{ x: 5 }}
                        key={ev.id} 
                        style={{ 
                          display: 'flex', gap: 10, alignItems: 'center', padding: '10px', 
                          borderRadius: 16, background: '#f8fafc', border: '1px solid transparent'
                        }}
                      >
                        <div style={{ 
                          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                          background: (ev.cor ?? TIPO_CORES[ev.tipo]) + '15',
                          color: ev.cor ?? TIPO_CORES[ev.tipo],
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900
                        }}>
                          <span>{d}</span>
                          <span style={{ fontSize: 8 }}>{MESES[parseInt(m)-1].slice(0,3)}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{TIPO_LABELS[ev.tipo]}</div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{opacity:0, y: '100%'}} animate={{opacity:1, y: 0}} exit={{opacity:0, y: '100%'}} transition={{ type: "spring", stiffness: 300, damping: 30 }} style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 1000, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', zIndex: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 20, fontFamily: 'Outfit, sans-serif', color: '#1e293b' }}>{editingId ? '⚡ Editar Evento' : '✨ Novo Evento'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setEditingId(null); }} style={{ background: '#f1f5f9', borderRadius: '50%' }}><X size={18} /></button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1, paddingBottom: 100 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Título do Evento</label>
                  <input className="form-input" style={{ borderRadius: 14, height: 48, fontSize: 14, fontWeight: 600 }} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Reunião Pedagógica" />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Data Início</label>
                    <input className="form-input" style={{ borderRadius: 14, height: 48 }} type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>Data Final (Opc.)</label>
                    <input className="form-input" style={{ borderRadius: 14, height: 48 }} type="date" value={form.dataFim || ''} min={form.data} disabled={!!editingId} onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
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

              <div style={{ display: 'flex', gap: 12, marginTop: 'auto', paddingTop: 32, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" style={{ height: 48, padding: '0 24px', borderRadius: 14, fontWeight: 700 }} onClick={() => setShowModal(false)}>Descartar</button>
                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn btn-primary" 
                  style={{ flex: 1, height: 48, padding: '0 32px', borderRadius: 14, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)' }}
                  onClick={handleAdd}
                >
                  Confirmar e Salvar
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSelectionModal.open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(12px)' }}>
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
                  turmasNomes.filter((t: any) => t.toLowerCase().includes(searchTermSelection.toLowerCase())).map((t: any) => {
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
                  usuariosAtivos.filter((u: any) => u.nome.toLowerCase().includes(searchTermSelection.toLowerCase())).map((u: any) => {
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
        )}
      </AnimatePresence>
    </div>
  )
}
