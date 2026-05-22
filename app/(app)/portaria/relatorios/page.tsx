'use client'

import { useState, useMemo } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  FileSpreadsheet, Calendar, Users, FileText, ArrowLeft, RefreshCw,
  Search, Filter, Download, Activity, Scan, ChevronDown, CheckCircle,
  XCircle, AlertTriangle, Printer, BarChart3, HelpCircle, UserX, UserCheck,
  Clock
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function PortariaRelatoriosPage() {
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10))
  const [turmaId, setTurmaId] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [activeTab, setActiveTab] = useState<'geral' | 'presenca' | 'logs'>('geral')

  // 1. Buscar Turmas
  const { data: turmasRes } = useApiQuery<{ data: any[] }>(
    ['portaria-relatorios-turmas'],
    '/api/turmas',
    { all: 'true' },
    { staleTime: 60000 }
  )
  const turmas = turmasRes?.data || []

  // 2. Buscar Eventos de Portaria na Faixa de Datas
  const { data: eventosRes, isLoading: loadingEventos, refetch: refetchEventos } = useApiQuery<{ data: any[] }>(
    ['portaria-relatorios-eventos', dataInicio, dataFim],
    '/api/portaria/eventos',
    {
      data_inicio: `${dataInicio}T00:00:00`,
      data_fim: `${dataFim}T23:59:59`,
      limit: '1500'
    },
    { staleTime: 10000 }
  )
  const eventos = eventosRes?.data || []

  // 3. Buscar Alunos da Turma Selecionada (se houver)
  const { data: alunosRes, isLoading: loadingAlunos } = useApiQuery<any>(
    ['portaria-relatorios-alunos', turmaId],
    '/api/alunos',
    turmaId ? { turma: turmaId, limit: '1000' } : undefined,
    { enabled: !!turmaId, staleTime: 30000 }
  )
  const alunosRoster = useMemo(() => {
    if (!turmaId) return []
    return Array.isArray(alunosRes) ? alunosRes : (alunosRes?.data || [])
  }, [alunosRes, turmaId])

  // Filtrar eventos por busca, turma e status
  const filteredEventos = useMemo(() => {
    return eventos.filter((e: any) => {
      // Filtro de Status
      if (statusFilter !== 'todos') {
        if (e.status !== statusFilter) return false
      }
      // Filtro de Turma
      if (turmaId) {
        // e.aluno_turma contêm o ID da turma no formato "ID - Nome" ou "ID"
        const eventTurmaId = e.aluno_turma ? e.aluno_turma.split(' - ')[0] : ''
        if (eventTurmaId !== turmaId) return false
      }
      // Filtro de Busca por Aluno
      if (buscaAluno) {
        const q = buscaAluno.toLowerCase()
        const matchNome = (e.aluno_nome || '').toLowerCase().includes(q)
        const matchMatricula = (e.user_id_equipamento || '').includes(q)
        if (!matchNome && !matchMatricula) return false
      }
      return true
    })
  }, [eventos, statusFilter, turmaId, buscaAluno])

  // Cálculo de Presença & Faltosos (Cross-reference)
  const auditPresenca = useMemo(() => {
    if (!turmaId || alunosRoster.length === 0) return { presentes: [], faltantes: [] }

    // Obter apenas eventos de sucesso para a turma selecionada na faixa de datas
    const successScans = eventos.filter((e: any) => {
      const eventTurmaId = e.aluno_turma ? e.aluno_turma.split(' - ')[0] : ''
      return e.status === 'sucesso' && eventTurmaId === turmaId
    })

    const presentes: any[] = []
    const faltantes: any[] = []

    alunosRoster.forEach((student: any) => {
      // Filtrar scans deste aluno
      const studentScans = successScans.filter((s: any) => s.aluno_id === student.id)
      
      if (studentScans.length > 0) {
        // Ordenar os scans por horário
        const sortedScans = [...studentScans].sort(
          (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
        )
        presentes.push({
          student,
          primeiroAcesso: sortedScans[0].data_hora,
          ultimoAcesso: sortedScans[sortedScans.length - 1].data_hora,
          scansCount: sortedScans.length
        })
      } else {
        faltantes.push(student)
      }
    })

    return { presentes, faltantes }
  }, [turmaId, alunosRoster, eventos])

  // Estatísticas e Métricas Gerais (sobre os eventos filtrados)
  const stats = useMemo(() => {
    const total = filteredEventos.length
    const sucesso = filteredEventos.filter((e: any) => e.status === 'sucesso').length
    const falha = filteredEventos.filter((e: any) => e.status === 'falha').length
    const inconsistente = filteredEventos.filter((e: any) => e.status === 'inconsistencia').length
    
    // Alunos únicos que acessaram
    const uniqueStudents = Array.from(new Set(filteredEventos.map((e: any) => e.aluno_id).filter(Boolean)))
    
    return {
      total,
      sucesso,
      falha,
      inconsistente,
      uniqueCount: uniqueStudents.length,
      successRate: total > 0 ? Math.round((sucesso / total) * 100) : 100
    }
  }, [filteredEventos])

  // Distribuição por Hora (Gráfico de Barras SVG)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 6) // De 06h a 20h
    const counts = hours.reduce((acc, h) => ({ ...acc, [h]: 0 }), {} as Record<number, number>)

    filteredEventos.forEach((e: any) => {
      const hour = new Date(e.data_hora).getUTCHours()
      if (hour >= 6 && hour <= 20) {
        counts[hour]++
      }
    })

    const maxCount = Math.max(...Object.values(counts), 1)
    return hours.map(h => ({
      hour: `${String(h).padStart(2, '0')}h`,
      count: counts[h],
      percentage: (counts[h] / maxCount) * 100
    }))
  }, [filteredEventos])

  // Exportar dados para CSV
  const exportToCSV = () => {
    const headers = ['Data/Hora', 'ID Equipamento', 'Matricula/ID', 'Aluno', 'Turma', 'Dispositivo', 'Status']
    const rows = filteredEventos.map((e: any) => [
      formatDateTimeUTC(e.data_hora),
      e.user_id_equipamento || '',
      e.aluno_id || '',
      e.aluno_nome || 'Não Identificado',
      e.aluno_turma || 'Sem Turma',
      e.dispositivo_nome || '',
      e.status.toUpperCase()
    ])

    const csvContent = [headers, ...rows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `relatorio_portaria_${dataInicio}_a_${dataFim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Trigger para impressão da página
  const handlePrint = () => {
    window.print()
  }

  const statusBadge = (st: string) => {
    if (st === 'sucesso') return { bg: 'rgba(16,185,129,0.08)', color: '#10b981', border: 'rgba(16,185,129,0.15)', label: 'Sucesso' }
    if (st === 'falha') return { bg: 'rgba(244,63,94,0.08)', color: '#f43f5e', border: 'rgba(244,63,94,0.15)', label: 'Falha' }
    return { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: 'rgba(245,158,11,0.15)', label: 'Inconsistência' }
  }

  const formatTimeUTC = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const h = String(d.getUTCHours()).padStart(2, '0')
    const m = String(d.getUTCMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  const formatDateTimeUTC = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const year = d.getUTCFullYear()
    const h = String(d.getUTCHours()).padStart(2, '0')
    const m = String(d.getUTCMinutes()).padStart(2, '0')
    const s = String(d.getUTCSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} ${h}:${m}:${s}`
  }

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return '—'
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  }

  return (
    <div style={{ paddingBottom: 60 }} className="print-container">
      
      {/* Estilo CSS customizado para impressão e scrollbars premium */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: transparent !important;
            color: #000 !important;
            box-shadow: none !important;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 20px;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 11px;
            text-align: left;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }} className="no-print">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0.05) 100%)',
              border: `1px solid ${ACCENT}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileSpreadsheet size={18} color={ACCENT} />
            </div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))', letterSpacing: '-0.03em' }}>
              Relatórios de Acesso Facial
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>
            Filtre, analise e audite o tráfego de alunos nas catracas inteligentes iDFace.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { refetchEventos() }}
            disabled={loadingEventos}
            style={{
              height: 38, padding: '0 14px', borderRadius: 10,
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} style={{ animation: loadingEventos ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          
          <button
            onClick={exportToCSV}
            style={{
              height: 38, padding: '0 14px', borderRadius: 10,
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Download size={14} />
            Exportar CSV
          </button>

          <button
            onClick={handlePrint}
            style={{
              height: 38, padding: '0 14px', borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT} 0%, #0891b2 100%)`, border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              boxShadow: `0 4px 14px ${ACCENT}30`, transition: 'all 0.2s'
            }}
          >
            <Printer size={14} />
            Imprimir Relatório
          </button>
        </div>
      </div>

      {/* Seção Filtros */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 18, padding: '20px 24px',
        marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: 16,
        alignItems: 'flex-end',
        boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
      }} className="no-print">
        
        {/* Data Início */}
        <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Data Início</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              style={{
                width: '100%', height: 38, borderRadius: 10,
                background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                paddingLeft: 36, paddingRight: 12, fontSize: 13, fontWeight: 700,
                color: 'hsl(var(--text-primary))', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Data Fim */}
        <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Data Fim</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              style={{
                width: '100%', height: 38, borderRadius: 10,
                background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                paddingLeft: 36, paddingRight: 12, fontSize: 13, fontWeight: 700,
                color: 'hsl(var(--text-primary))', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Filtrar por Turma */}
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Filtrar por Turma</label>
          <div style={{ position: 'relative' }}>
            <Users size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }} />
            <select
              value={turmaId}
              onChange={e => setTurmaId(e.target.value)}
              style={{
                width: '100%', height: 38, borderRadius: 10,
                background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                paddingLeft: 36, paddingRight: 12, fontSize: 13, fontWeight: 700,
                color: 'hsl(var(--text-primary))', outline: 'none', appearance: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Todas as Turmas</option>
              {turmas.map((t: any) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Filtrar por Status */}
        <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status de Acesso</label>
          <div style={{ position: 'relative' }}>
            <Activity size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                width: '100%', height: 38, borderRadius: 10,
                background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                paddingLeft: 36, paddingRight: 12, fontSize: 13, fontWeight: 700,
                color: 'hsl(var(--text-primary))', outline: 'none', appearance: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="todos">Todos</option>
              <option value="sucesso">Sucesso (Liberado)</option>
              <option value="falha">Falha (Negado)</option>
              <option value="inconsistencia">Inconsistência</option>
            </select>
            <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Busca por Aluno */}
        <div style={{ flex: '2 1 250px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Buscar Aluno</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Nome do aluno ou matrícula..."
              value={buscaAluno}
              onChange={e => setBuscaAluno(e.target.value)}
              style={{
                width: '100%', height: 38, borderRadius: 10,
                background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                paddingLeft: 36, paddingRight: 12, fontSize: 13, fontWeight: 700,
                color: 'hsl(var(--text-primary))', outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 1 }} className="no-print">
        {[
          { id: 'geral', label: 'Visão Geral & Métricas', icon: <BarChart3 size={15} /> },
          { id: 'presenca', label: 'Presença & Faltosos', icon: <Users size={15} /> },
          { id: 'logs', label: 'Logs de Eventos', icon: <FileText size={15} /> }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '10px 18px', fontSize: 13.5, fontWeight: 800,
              color: activeTab === t.id ? ACCENT : 'hsl(var(--text-muted))',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === t.id ? `3px solid ${ACCENT}` : '3px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
              marginBottom: -2
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO DOS RELATÓRIOS */}

      {/* 1. VISÃO GERAL */}
      {activeTab === 'geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          
          {/* Grid de Cards de Estatísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            
            {/* Total de Acessos */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Scan size={18} color={ACCENT} />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Acessos</span>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: '4px 0 0 0' }}>{stats.total}</h3>
              </div>
            </div>

            {/* Taxa de Sucesso */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <CheckCircle size={18} color="#10b981" />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Taxa de Sucesso</span>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: '#10b981', margin: '4px 0 0 0' }}>{stats.successRate}%</h3>
              </div>
            </div>

            {/* Falhas / Negados */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <XCircle size={18} color="#f43f5e" />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acessos Negados</span>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: '#f43f5e', margin: '4px 0 0 0' }}>{stats.falha}</h3>
              </div>
            </div>

            {/* Alunos Únicos */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Users size={18} color="#f59e0b" />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Alunos Únicos</span>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: '4px 0 0 0' }}>{stats.uniqueCount}</h3>
              </div>
            </div>

          </div>

          {/* Gráficos de Estatísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            
            {/* Distribuição Horária */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 18, padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: 'hsl(var(--text-primary))', marginBottom: 20 }}>
                Distribuição Horária dos Acessos
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {hourlyData.map((d, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', width: 40, fontFamily: 'monospace', fontWeight: 600 }}>{d.hour}</span>
                    <div style={{ flex: 1, height: 8, background: 'hsl(var(--bg-base))', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${d.percentage}%`, height: '100%',
                        background: `linear-gradient(90deg, ${ACCENT} 0%, #0891b2 100%)`,
                        borderRadius: 4, transition: 'width 0.5s ease-out'
                      }} />
                    </div>
                    <span style={{ fontSize: 11.5, color: 'hsl(var(--text-primary))', fontWeight: 800, width: 35, textAlign: 'right' }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalhamento dos Eventos */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 18, padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: 'hsl(var(--text-primary))', marginBottom: 20 }}>
                  Detalhamento de Status dos Acessos
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Sucesso (Liberado)', value: stats.sucesso, color: '#10b981', pct: stats.total > 0 ? Math.round((stats.sucesso / stats.total) * 100) : 0 },
                    { label: 'Negados / Falhas', value: stats.falha, color: '#f43f5e', pct: stats.total > 0 ? Math.round((stats.falha / stats.total) * 100) : 0 },
                    { label: 'Inconsistências', value: stats.inconsistente, color: '#f59e0b', pct: stats.total > 0 ? Math.round((stats.inconsistente / stats.total) * 100) : 0 }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-base))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>{item.label}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{item.value}</span>
                        <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 6 }}>({item.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(6,182,212,0.04)', borderRadius: 12, border: `1px solid ${ACCENT}15`, display: 'flex', gap: 12, alignItems: 'center' }}>
                <Activity size={18} color={ACCENT} />
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.4, margin: 0 }}>
                  Dica de Auditoria: Filtre por uma <strong>Turma específica</strong> nas abas superiores para acessar o controle individual e saber quem faltou às aulas hoje.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 2. PRESENÇA & FALTOSOS */}
      {activeTab === 'presenca' && (
        <div>
          {!turmaId ? (
            <div style={{
              textAlign: 'center', padding: '60px 40px', background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border-subtle))', borderRadius: 18,
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
            }}>
              <Users size={40} style={{ opacity: 0.3, color: ACCENT }} />
              <div style={{ maxWidth: 400 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>
                  Escolha uma Turma para Auditar
                </h3>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                  Selecione uma turma no seletor de filtros acima para gerar automaticamente o cruzamento de chamada e saber quem faltou e quem está presente.
                </p>
              </div>
            </div>
          ) : loadingAlunos ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
              <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13 }}>Varrendo o diário de presença dos alunos...</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
              
              {/* Presentes */}
              <div style={{
                background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
              }}>
                <div style={{
                  padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-base))', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserCheck size={16} color="#10b981" />
                    <span style={{ fontSize: 13.5, fontWeight: 900, color: 'hsl(var(--text-primary))' }}>Presentes ({auditPresenca.presentes.length})</span>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                    {alunosRoster.length > 0 ? Math.round((auditPresenca.presentes.length / alunosRoster.length) * 100) : 0}% de presença
                  </span>
                </div>

                <div style={{ maxHeight: 440, overflow: 'auto' }}>
                  {auditPresenca.presentes.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 12.5 }}>
                      Nenhum aluno registrou entrada válida na catraca até o momento.
                    </div>
                  ) : (
                    auditPresenca.presentes.map((p, idx) => (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 20px', borderBottom: '1px solid hsl(var(--border-subtle))'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                            flexShrink: 0
                          }}>
                            {p.student.foto ? (
                              <img src={p.student.foto} alt={p.student.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ fontSize: 8, fontWeight: 800, color: 'hsl(var(--text-muted))' }}>
                                {(p.student.nome || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.student.nome}
                            </div>
                            <div style={{ fontSize: 9.5, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              <span>Matrícula: {p.student.matricula || '—'}</span>
                              <span style={{ opacity: 0.5 }}>•</span>
                              <span>Turma: {p.student.turma ? `${p.student.turma} - ${turmas.find((t: any) => String(t.id) === String(p.student.turma))?.nome || ''}` : 'Sem Turma'}</span>
                              {p.student.turno && (
                                <>
                                  <span style={{ opacity: 0.5 }}>•</span>
                                  <span>Turno: {p.student.turno.charAt(0).toUpperCase() + p.student.turno.slice(1)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} color={ACCENT} /> {formatTimeUTC(p.primeiroAcesso)}
                          </div>
                          {p.scansCount > 1 && (
                            <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                              Último: {formatTimeUTC(p.ultimoAcesso)} ({p.scansCount}x)
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Faltosos */}
              <div style={{
                background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
              }}>
                <div style={{
                  padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-base))', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserX size={16} color="#f43f5e" />
                    <span style={{ fontSize: 13.5, fontWeight: 900, color: 'hsl(var(--text-primary))' }}>Faltantes ({auditPresenca.faltantes.length})</span>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: 'rgba(244,63,94,0.08)', color: '#f43f5e' }}>
                    {alunosRoster.length > 0 ? Math.round((auditPresenca.faltantes.length / alunosRoster.length) * 100) : 0}% de ausência
                  </span>
                </div>

                <div style={{ maxHeight: 440, overflow: 'auto' }}>
                  {auditPresenca.faltantes.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 12.5 }}>
                      Todos os alunos matriculados nesta turma registraram entrada hoje!
                    </div>
                  ) : (
                    auditPresenca.faltantes.map((f, idx) => (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 20px', borderBottom: '1px solid hsl(var(--border-subtle))'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                            flexShrink: 0
                          }}>
                            {f.foto ? (
                              <img src={f.foto} alt={f.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ fontSize: 8, fontWeight: 800, color: 'hsl(var(--text-muted))' }}>
                                {(f.nome || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.nome}
                            </div>
                            <div style={{ fontSize: 9.5, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              <span>Matrícula: {f.matricula || '—'}</span>
                              <span style={{ opacity: 0.5 }}>•</span>
                              <span>Turma: {f.turma ? `${f.turma} - ${turmas.find((t: any) => String(t.id) === String(f.turma))?.nome || ''}` : 'Sem Turma'}</span>
                              {f.turno && (
                                <>
                                  <span style={{ opacity: 0.5 }}>•</span>
                                  <span>Turno: {f.turno.charAt(0).toUpperCase() + f.turno.slice(1)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          {f.telefone && (
                            <a
                              href={`tel:${f.telefone}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: 8, background: 'hsl(var(--bg-base))',
                                border: '1px solid hsl(var(--border-subtle))', color: ACCENT
                              }}
                            >
                              📞
                            </a>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(244,63,94,0.08)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.15)' }}>
                            FALTOU
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* 3. LOGS DE EVENTOS */}
      {activeTab === 'logs' && (
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
        }}>
          
          {/* Header da Tabela */}
          <div style={{
            display: 'grid', gridTemplateColumns: '150px 80px 1.2fr 1.2fr 1.2fr 130px',
            gap: 12, padding: '14px 20px',
            borderBottom: '1px solid hsl(var(--border-subtle))',
            background: 'hsl(var(--bg-base))'
          }}>
            {['DATA/HORA', 'ID TERMINAL', 'ALUNO', 'TURMA', 'DISPOSITIVO', 'STATUS'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
            ))}
          </div>

          {/* Registros */}
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            {filteredEventos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
                <Scan size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Nenhum log de acesso localizado para os filtros atuais.</div>
              </div>
            ) : (
              filteredEventos.map((e, idx) => {
                const badge = statusBadge(e.status)
                const nomeTurma = e.aluno_turma ? (e.aluno_turma.includes(' - ') ? e.aluno_turma.split(' - ')[1] : e.aluno_turma) : '—'
                return (
                  <div
                    key={e.id || idx}
                    style={{
                      display: 'grid', gridTemplateColumns: '150px 80px 1.2fr 1.2fr 1.2fr 130px',
                      gap: 12, padding: '12px 20px', alignItems: 'center',
                      borderBottom: '1px solid hsl(var(--border-subtle))',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                      {formatDateTimeUTC(e.data_hora)}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: ACCENT, fontFamily: 'monospace' }}>
                      {e.user_id_equipamento || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                        flexShrink: 0
                      }}>
                        {e.aluno_foto ? (
                          <img src={e.aluno_foto} alt={e.aluno_nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ fontSize: 8, fontWeight: 800, color: 'hsl(var(--text-muted))' }}>
                            {(e.aluno_nome || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.aluno_nome || 'Não Identificado'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nomeTurma}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.dispositivo_nome || 'Desconhecido'}
                    </div>
                    <div>
                      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>
      )}

      {/* DETALHES DE IMPRESSÃO (Oculto na Web, visível no Print/PDF) */}
      <div style={{ display: 'none' }} className="print-table">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Ficha de Auditoria de Acesso Facial (iDFace)</h2>
        <p style={{ fontSize: 11, marginBottom: 20 }}>
          Período: {formatDateOnly(dataInicio)} a {formatDateOnly(dataFim)} · Turma: {turmaId ? turmas.find((t: any) => String(t.id) === String(turmaId))?.nome || turmaId : 'Todas'}
        </p>

        <h3 style={{ fontSize: 13, borderBottom: '1px solid #000', paddingBottom: 4, marginTop: 20 }}>Métricas Gerais</h3>
        <table style={{ width: '100%', marginBottom: 20, fontSize: 11 }}>
          <tbody>
            <tr>
              <td><strong>Total Acessos:</strong> {stats.total}</td>
              <td><strong>Taxa Sucesso:</strong> {stats.successRate}%</td>
              <td><strong>Acessos Negados:</strong> {stats.falha}</td>
              <td><strong>Alunos Únicos:</strong> {stats.uniqueCount}</td>
            </tr>
          </tbody>
        </table>

        {turmaId && (
          <>
            <h3 style={{ fontSize: 13, borderBottom: '1px solid #000', paddingBottom: 4, marginTop: 20 }}>
              Alunos Faltantes ({auditPresenca.faltantes.length})
            </h3>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome do Aluno</th>
                  <th>Contato Responsável</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditPresenca.faltantes.map((f, i) => (
                  <tr key={i}>
                    <td>{f.matricula || '—'}</td>
                    <td>{f.nome}</td>
                    <td>{f.telefone || '—'}</td>
                    <td>FALTOU</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3 style={{ fontSize: 13, borderBottom: '1px solid #000', paddingBottom: 4, marginTop: 20 }}>
          Registros de Auditoria ({filteredEventos.length})
        </h3>
        <table className="print-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Matrícula/ID</th>
              <th>Aluno</th>
              <th>Turma</th>
              <th>Dispositivo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEventos.map((e, i) => (
              <tr key={i}>
                <td>{formatDateTimeUTC(e.data_hora)}</td>
                <td>{e.user_id_equipamento || '—'}</td>
                <td>{e.aluno_nome || 'Não Identificado'}</td>
                <td>{e.aluno_turma || 'Sem Turma'}</td>
                <td>{e.dispositivo_nome || '—'}</td>
                <td>{e.status.toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
