'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApiQuery } from '@/hooks/useApi'
import React, { useMemo, useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, Shield, Heart, School, Calendar, User, Clock, FileText, Check, Loader2, Info, ChevronDown } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

export default function ADOcorrenciasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital()
  const { currentUser } = useApp()
  const [signingIds, setSigningIds] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline')
  const [selectedYear, setSelectedYear] = useState<string>('')

  const { aluno } = useSelectedStudent()
  const { turmas = [] } = useData()
  
  // Consumindo dados via API usando React Query
  const endpoint = aluno?.id ? `/api/ocorrencias?aluno_id=${aluno.id}` : ''
  const { data: rawOcorrencias, refetch, isLoading } = useApiQuery<any[]>(['ocorrencias', aluno?.id], endpoint, undefined, { enabled: !!endpoint })
  const ocorrencias = rawOcorrencias || []
  
  const queryClient = useQueryClient()

  useAgendaRealtime({
    table: 'ocorrencias',
    toastConfig: {
      enabled: true,
      insertMessage: (doc) => `Nova ocorrência registrada!`,
      updateMessage: (doc) => `Ocorrência atualizada!`,
      icon: <AlertTriangle size={18} color="#ef4444" />
    },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias', aluno?.id] })
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias', aluno?.id] })
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias', aluno?.id] })
    }
  });

  // Impede visualização se a coordenação/admin bloqueou no config
  if (adConfig?.permissoes?.visualizarOcorrencias === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <div style={{ background: '#fff', padding: 40, borderRadius: 32, textAlign: 'center', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', maxWidth: 500 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
            <AlertCircle size={40} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>Acesso Restrito</h3>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            A visualização de histórico comportamental e ocorrências está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica.
          </p>
        </div>
      </div>
    )
  }

  // Ordena por data (mais recente no topo) e garante match
  const ocorrenciasDoAluno = useMemo(() => {
    return ocorrencias
      .filter(o => String(o.aluno_id) === String(aluno?.id) || String(o.alunoId) === String(aluno?.id))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [ocorrencias, aluno?.id])

  // Extrair anos disponíveis dinamicamente
  
  // Extrair turmas disponíveis dinamicamente
  const turmasIds = useMemo(() => {
    const ids = [aluno?.turma];
    if (aluno?.dados?.historicoTurmas) {
      aluno.dados.historicoTurmas.forEach((ht: any) => {
        if (ht.serieTurma) ids.push(ht.serieTurma);
      });
    }
    return ids.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  }, [aluno]);

  const turmasDisponiveis = useMemo(() => {
    return turmasIds.map(id => {
      const t = turmas.find(t => String(t.id) === String(id) || String(t.codigo) === String(id) || String(t.nome) === String(id));
      return { id, nome: t?.nome || id };
    });
  }, [turmasIds, turmas]);

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');

  useEffect(() => {
    if (turmasDisponiveis.length > 0 && !selectedTurmaId) {
      const current = turmasDisponiveis.find(t => String(t.id) === String(aluno?.turma)) || turmasDisponiveis[0];
      setSelectedTurmaId(current.id);
    }
  }, [turmasDisponiveis, selectedTurmaId, aluno?.turma]);

  const anosDisponiveis = useMemo(() => {
    const years = ocorrenciasDoAluno.map(o => o.ano || (o.data ? o.data.substring(0, 4) : new Date().getFullYear().toString()))
    const uniqueYears = Array.from(new Set(years)).sort((a, b) => b.localeCompare(a))
    if (uniqueYears.length === 0) {
      uniqueYears.push(new Date().getFullYear().toString())
    }
    return uniqueYears
  }, [ocorrenciasDoAluno])

  // Inicializa o ano selecionado
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !selectedYear) {
      setSelectedYear(anosDisponiveis[0])
    }
  }, [anosDisponiveis, selectedYear])

  // Filtra as ocorrências pelo ano selecionado (independente da turma)
  const ocorrenciasFiltradas = useMemo(() => {
    if (!selectedYear) return []
    return ocorrenciasDoAluno.filter(o => {
      const ano = o.ano || (o.data ? o.data.substring(0, 4) : new Date().getFullYear().toString())
      return ano === selectedYear;
    })
  }, [ocorrenciasDoAluno, selectedYear])



  // Resolve a turma selecionada com nome e turno correspondente
  const turmaDoAluno = useMemo(() => {
    if (!aluno || !selectedTurmaId) return 'SEM TURMA'
    const turmaObj = turmas.find(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId) || String(t.nome) === String(selectedTurmaId))
    
    const nome = turmaObj?.nome || selectedTurmaId || 'Sem Turma'
    const turno = turmaObj?.turno || aluno.turno || 'Vespertino'
    
    return `${nome} - ${turno}`.toUpperCase()
  }, [aluno, turmas, selectedTurmaId])

  // Estatísticas para os cards superiores
  const stats = useMemo(() => {
    const total = ocorrenciasFiltradas.length
    const pendentes = ocorrenciasFiltradas.filter(o => {
      const lowerTipo = (o.tipo || '').toLowerCase()
      const isElogio = lowerTipo === 'elogio' || lowerTipo === 'parabéns' || lowerTipo === 'parabens'
      return !o.ciencia_responsavel && !isElogio
    }).length
    return { total, pendentes }
  }, [ocorrenciasFiltradas])

  // Marca como lido automaticamente as ocorrências não lidas
  useEffect(() => {
    if (!aluno?.id || ocorrenciasFiltradas.length === 0) return;
    
    const unreadIds = ocorrenciasFiltradas
      .filter(o => {
        const leituras = (o as any).dados?.leituras || (o as any).leituras || {};
        return !leituras[aluno.id];
      })
      .map(o => o.id);

    if (unreadIds.length > 0) {
      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'ocorrencia',
          ids: unreadIds,
          alunoId: aluno.id
        })
      })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        }
      })
      .catch(err => console.error('Failed to mark ocorrencias as read:', err));
    }
  }, [ocorrenciasFiltradas, aluno?.id]);

  const handleAssinar = async (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return

    setSigningIds(prev => ({ ...prev, [id]: true }))
    
    const now = new Date()
    const dataHora = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const userLabel = currentUser?.nome || 'Responsável'
    const confirmInfo = `[Confirmado por: ${userLabel} em ${dataHora}]`
    
    const payload = {
      ...oc,
      ciencia_responsavel: true,
      descricao: oc.descricao ? `${oc.descricao}\n${confirmInfo}` : confirmInfo
    }

    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (response.ok) {
        refetch() // Atualiza cache Query
      } else {
        const err = await response.json().catch(() => ({}))
        alert('Erro ao registrar ciência: ' + (err.error || response.statusText))
      }
    } catch (error: any) {
      alert('Erro de conexão ao servidor: ' + error.message)
    } finally {
      setSigningIds(prev => ({ ...prev, [id]: false }))
    }
  }

  const getNomeTurmaOcorrencia = (o: any) => {
    if (!o.turma && !o.turma_id) return 'Sem turma vinculada';
    const idOrName = o.turma_id || o.turma;
    const tObj = turmas.find(t => String(t.id) === String(idOrName) || String(t.codigo) === String(idOrName) || String(t.nome) === String(idOrName));
    return tObj?.nome || o.turma || 'Turma desconhecida';
  };

  // Formatador de data e hora para exibição completa
  const formatDateTime = (dateStr: string, fallbackDate: string) => {
    try {
      if (!dateStr) {
        if (fallbackDate) {
          const parts = fallbackDate.split('-')
          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
        }
        return ''
      }
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) {
        if (fallbackDate) {
          const parts = fallbackDate.split('-')
          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
        }
        return ''
      }
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${day}/${month}/${year} às ${hours}:${minutes}`
    } catch (e) {
      return ''
    }
  }

  return (
    <div style={{ padding: '24px 20px 60px 20px', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      {/* 1. TOP CARDS GRID */}
      <div className="stats-grid">
        {/* Left Card: Total Ocorrências */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ 
            background: 'linear-gradient(135deg, #ffffff 0%, #f5f8ff 100%)', 
            borderRadius: 24, 
            padding: '24px 28px', 
            border: '1px solid #eef2ff',
            boxShadow: '0 10px 30px rgba(79, 70, 229, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: 20
          }}
        >
          <div style={{
            width: 76,
            height: 76,
            borderRadius: 20,
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Total de ocorrências</div>
            <div style={{ fontSize: 38, color: '#1e40af', fontWeight: 800, fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>{stats.total}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>registradas</div>
          </div>
        </motion.div>

        {/* Right Card: Situação Geral */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          style={{ 
            background: stats.pendentes > 0 
              ? 'linear-gradient(135deg, #ffffff 0%, #fffdf5 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #fcfefe 100%)', 
            borderRadius: 24, 
            padding: '24px 28px', 
            border: stats.pendentes > 0 ? '1px solid #fef3c7' : '1px solid #e6f4ea',
            boxShadow: stats.pendentes > 0 
              ? '0 10px 30px rgba(245, 158, 11, 0.02)'
              : '0 10px 30px rgba(16, 185, 129, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, zIndex: 2 }}>
            {stats.pendentes > 0 ? (
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#fffbeb',
                border: '1.5px solid #fcd34d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={24} color="#d97706" />
              </div>
            ) : (
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#e6f4ea',
                border: '1.5px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Check size={26} color="#059669" strokeWidth={3} />
              </div>
            )}

            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Situação geral</div>
              <div style={{ 
                fontSize: 26, 
                color: stats.pendentes > 0 ? '#d97706' : '#059669', 
                fontWeight: 800, 
                fontFamily: 'Outfit, sans-serif', 
                margin: '2px 0' 
              }}>
                {stats.pendentes > 0 ? 'Atenção' : 'Tudo certo'}
              </div>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                {stats.pendentes > 0 
                  ? `Você possui ${stats.pendentes} ocorrência(s) pendente(s) de ciência.`
                  : 'Não há pendências disciplinares no momento.'}
              </div>
            </div>
          </div>

          {/* SVG Shield Decoration (Right side) */}
          <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 1, pointerEvents: 'none' }}>
            {stats.pendentes > 0 ? (
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
                <defs>
                  <linearGradient id="shieldWarnGrad" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#D97706" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="borderWarnGrad" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#D97706" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                <circle cx="95" cy="40" r="4" fill="#F59E0B" opacity="0.3" />
                <circle cx="25" cy="85" r="5" fill="#F59E0B" opacity="0.12" />
                <circle cx="35" cy="25" r="3" fill="#F59E0B" opacity="0.18" />
                <path d="M60 20C75 20 85 24 95 32C95 62 82 85 60 98C38 85 25 62 25 32C35 24 45 20 60 20Z" fill="url(#shieldWarnGrad)" stroke="url(#borderWarnGrad)" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M60 45V65" stroke="#F59E0B" strokeWidth="5.5" strokeLinecap="round" opacity="0.8" />
                <circle cx="60" cy="76" r="3" fill="#F59E0B" opacity="0.8" />
              </svg>
            ) : (
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
                <defs>
                  <linearGradient id="shieldGrad" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="borderGrad" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                <circle cx="95" cy="40" r="4" fill="#34D399" opacity="0.3" />
                <circle cx="25" cy="85" r="5" fill="#34D399" opacity="0.12" />
                <circle cx="35" cy="25" r="3" fill="#34D399" opacity="0.18" />
                <path d="M60 20C75 20 85 24 95 32C95 62 82 85 60 98C38 85 25 62 25 32C35 24 45 20 60 20Z" fill="url(#shieldGrad)" stroke="url(#borderGrad)" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M48 58L56 66L72 50" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
              </svg>
            )}
          </div>
        </motion.div>
      </div>

      {/* 2. FILTER & VIEW SELECTOR ROW */}
      <div className="filters-row">
        <div className="filters-left">
          {/* Calendar Year Pill Dropdown */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 2
              }}
            >
              {anosDisponiveis.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 700,
              color: '#1e293b',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}>
              <Calendar size={15} style={{ color: '#64748b' }} />
              <span>{selectedYear}</span>
              <ChevronDown size={14} style={{ color: '#64748b' }} />
            </div>
          </div>




        </div>

        {/* View Switcher Segmented Control */}
        <div className="segmented-control">
          <button 
            onClick={() => setViewMode('timeline')}
            className={`segment-btn ${viewMode === 'timeline' ? 'active' : 'inactive'}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Timeline
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`segment-btn ${viewMode === 'list' ? 'active' : 'inactive'}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Lista
          </button>
        </div>
      </div>

      {/* 3. MAIN CONTENT: OCCURRENCES LIST */}
      {isLoading || !aluno ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(idx => (
             <div key={idx} style={{ padding: 24, display: 'flex', gap: 18, background: '#fff', borderRadius: 24, border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f1f5f9', animation: 'pulse-skeleton 1.5s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                   <div style={{ width: '40%', height: 20, background: '#f1f5f9', borderRadius: 6, marginBottom: 10, animation: 'pulse-skeleton 1.5s infinite' }} />
                   <div style={{ width: '80%', height: 14, background: '#f1f5f9', borderRadius: 6, marginBottom: 8, animation: 'pulse-skeleton 1.5s infinite' }} />
                   <div style={{ width: '60%', height: 14, background: '#f1f5f9', borderRadius: 6, animation: 'pulse-skeleton 1.5s infinite' }} />
                </div>
             </div>
          ))}
        </div>
      ) : ocorrenciasFiltradas.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <div style={{ background: '#fff', padding: '56px 40px', borderRadius: 28, textAlign: 'center', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.01)' }}>
             <div style={{ width: 80, height: 80, borderRadius: 40, background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <Heart size={40} />
             </div>
             <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>Sem Ocorrências!</h3>
             <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0, maxWidth: 450, marginInline: 'auto' }}>
               Que excelente notícia! O aluno não possui nenhum registro disciplinar ou comportamental registrado para o ano de {selectedYear}.
             </p>
          </div>
        </motion.div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Continuous vertical line for timeline */}
          {viewMode === 'timeline' && ocorrenciasFiltradas.length > 1 && (
            <div className="timeline-line" />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AnimatePresence>
              {ocorrenciasFiltradas.map((o, idx) => {
                const lowerTipo = (o.tipo || '').toLowerCase()
                const isElogio = lowerTipo === 'elogio' || lowerTipo === 'parabéns' || lowerTipo === 'parabens'
                const isAdvertencia = lowerTipo.includes('advertencia') || lowerTipo.includes('advertência') || o.gravidade === 'grave'
                
                const gravColor = isElogio ? '#10b981' : (isAdvertencia ? '#dc2626' : '#d97706')
                const gravBg = isElogio ? '#ecfdf5' : (isAdvertencia ? '#fef2f2' : '#fef3c7')
                const gravText = o.gravidade ? (o.gravidade === 'media' ? 'Média' : o.gravidade === 'grave' ? 'Grave' : 'Leve') : 'Leve'

                // Parse logged by meta strings
                const lines = (o.descricao || '').split('\n')
                let lancado = ''
                const descLines: string[] = []

                lines.forEach((line: string) => {
                  if (line.startsWith('[Lançado por:')) {
                    lancado = line.replace('[Lançado por: ', '').replace(']', '')
                  } else if (!line.startsWith('[Editado por:') && !line.startsWith('[Confirmado por:')) {
                    descLines.push(line)
                  }
                })
                const cleanedDesc = descLines.join('\n').trim()

                return (
                  <motion.div 
                    key={o.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    style={{ display: 'flex', alignItems: 'stretch', gap: 0, position: 'relative' }}
                  >
                    {/* Timeline bullet dot */}
                    {viewMode === 'timeline' && (
                      <div className="timeline-dot-col">
                        <div 
                          className="timeline-dot"
                          style={{ borderColor: isAdvertencia ? '#fca5a5' : '#fcd34d' }}
                        >
                          <div 
                            className="timeline-dot-inner"
                            style={{ background: isAdvertencia ? '#ef4444' : '#f59e0b' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Occurrence Card */}
                    <div className="occurrence-card" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Icon Block */}
                        {isAdvertencia ? (
                          <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: 18,
                            background: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <AlertTriangle size={28} color="#dc2626" />
                          </div>
                        ) : (
                          <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: 18,
                            background: '#fff7ed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <AlertCircle size={28} color="#f97316" />
                          </div>
                        )}

                        {/* Occurrence Content */}
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                            {o.tipo}
                          </h3>

                          {/* Metadata row with badge and registered by info */}
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {!isElogio && (
                              <span style={{ 
                                fontSize: 11, 
                                background: gravBg, 
                                color: gravColor, 
                                padding: '2px 8px', 
                                borderRadius: 6, 
                                fontWeight: 700, 
                                textTransform: 'uppercase', 
                                letterSpacing: 0.5 
                              }}>
                                {gravText}
                              </span>
                            )}
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>•</span>
                            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                              Registrado por <span style={{ color: '#475569', fontWeight: 600 }}>{lancado || o.responsavel || 'Coordenação'}</span>
                            </div>
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>|</span>
                            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                              {formatDateTime(o.created_at, o.data)}
                            </div>
                          </div>

                          <p style={{ fontSize: 14, color: '#334155', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {cleanedDesc || o.descricao}
                          </p>
                        </div>

                        {/* Date badge on top right */}
                        <div style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '6px 12px',
                          borderRadius: 8,
                          alignSelf: 'flex-start',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                        }}>
                          {o.data ? new Date(o.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                        </div>
                      </div>

                      {/* Footer Actions (Ver anexo & Ciência Assinada) */}
                      {(!isElogio || o.anexoUrl) && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          marginTop: 20, 
                          paddingTop: 16, 
                          borderTop: '1px solid #f1f5f9' 
                        }}>
                          {o.anexoUrl ? (
                            <a 
                              href={o.anexoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6, 
                                fontSize: 13, 
                                color: '#2563eb', 
                                textDecoration: 'none', 
                                fontWeight: 700, 
                                background: '#eff6ff', 
                                padding: '8px 14px', 
                                borderRadius: 10,
                                transition: 'all 0.2s'
                              }}
                              className="btn-attachment"
                            >
                              <FileText size={14} />
                              Ver anexo
                            </a>
                          ) : <div />}

                          {!isElogio && (
                            !o.ciencia_responsavel ? (
                              <button 
                                onClick={() => handleAssinar(o.id)} 
                                disabled={!!signingIds[o.id]}
                                style={{ 
                                  background: '#f59e0b', 
                                  border: 'none', 
                                  color: '#fff', 
                                  fontSize: 13, 
                                  fontWeight: 700, 
                                  padding: '8px 16px', 
                                  borderRadius: 10, 
                                  display: 'flex', 
                                  gap: 6, 
                                  alignItems: 'center', 
                                  cursor: signingIds[o.id] ? 'not-allowed' : 'pointer', 
                                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
                                  transition: 'all 0.2s'
                                }}
                                className="btn-sign"
                              >
                                {signingIds[o.id] ? (
                                  <Loader2 size={14} className="spin-animation" />
                                ) : (
                                  <Info size={14} />
                                )}
                                Assinar Ciência
                              </button>
                            ) : (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6, 
                                fontSize: 13, 
                                color: '#059669', 
                                fontWeight: 700, 
                                background: '#ecfdf5', 
                                padding: '8px 16px', 
                                borderRadius: 10, 
                                border: '1.5px solid #a7f3d0' 
                              }}>
                                <Check size={14} strokeWidth={3.5} />
                                Ciência Assinada
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Global CSS Styles */}
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 2.3fr;
          gap: 24px;
          margin-bottom: 32px;
        }
        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }
        }
        .filters-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .filters-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .segmented-control {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 14px;
        }
        .segment-btn {
          border: none;
          outline: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .segment-btn.active {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
          font-weight: 700;
        }
        .segment-btn.inactive {
          background: transparent;
          color: #64748b;
        }
        .segment-btn.inactive:hover {
          color: #334155;
        }
        .timeline-line {
          position: absolute;
          top: 52px;
          bottom: 52px;
          left: 28px;
          width: 2px;
          background: linear-gradient(to bottom, #f59e0b 20%, #ef4444 80%);
          z-index: 1;
        }
        .timeline-dot-col {
          position: absolute;
          left: 0;
          width: 58px;
          top: 0;
          bottom: 0;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }
        .timeline-dot {
          position: absolute;
          top: 42px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          border-width: 1.5px;
          border-style: solid;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .timeline-dot-inner {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .occurrence-card {
          background: #ffffff;
          border: 1px solid #f1f5f9;
          border-radius: 20px;
          padding: 24px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.008);
        }
        .occurrence-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.025);
        }
        .btn-attachment:hover {
          background: #dbeafe !important;
        }
        .btn-sign:hover {
          background: #d97706 !important;
          transform: translateY(-1px);
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-skeleton {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
