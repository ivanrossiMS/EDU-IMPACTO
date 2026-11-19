'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApiQuery } from '@/hooks/useApi'
import React, { useMemo, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, AlertCircle, CheckCircle, Eye, Check, Loader2, Filter, FileText, ShieldCheck, Sparkles, GraduationCap, User, Clock, Layers, Calendar } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

import { EmptyStateCard } from '../../components/EmptyStateCard'

const OCORRENCIA_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const OCORRENCIA_DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const OCORRENCIA_DATETIME_DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR')

function formatDateSeparatorCached(dateStr: string, todayKey: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const parts = OCORRENCIA_DATE_FORMATTER.format(d).split(' de ')
  const monthShort = (parts[1] || '').replace('.', '').substring(0, 3)
  const formatted = `${parts[0]} de ${monthShort}.`
  return dateStr === todayKey ? `Hoje, ${formatted}` : formatted
}

export default function ADOcorrenciasPage({ params }: { params: any }) {
  const { adConfig } = useAgendaDigital()
  const isOcorrenciasRestricted = adConfig?.permissoes?.visualizarOcorrencias === false

  const { currentUser } = useApp()
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const espelharRespId = searchParams?.get('espelhar_responsavel');
  const espelharAluno = searchParams?.get('espelhar_aluno') === 'true';
  const queryItemId = searchParams?.get('id') || searchParams?.get('ocorrencia_id') || searchParams?.get('item_id');
  const isMirroring = !!(espelharRespId || espelharAluno);
  const isAlunoLogado = Boolean(
    espelharAluno ||
    currentUser?.cargo === 'Aluno' ||
    currentUser?.perfil === 'Aluno' ||
    (currentUser as any)?.userType === 'aluno' ||
    ((currentUser as any)?.aluno_id && currentUser?.cargo !== 'Responsável' && !(currentUser as any)?.responsavel_id)
  );
  const [signingIds, setSigningIds] = useState<Record<string, boolean>>({})
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({})
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const hasAutoOpenedRef = React.useRef(false)

  const { aluno } = useSelectedStudent()
  const paramsHook = useParams<{ slug: string }>()
  const targetAlunoId = aluno?.id || paramsHook?.slug || (params as any)?.slug || ''

  const endpoint = targetAlunoId ? `/api/ocorrencias?aluno_id=${targetAlunoId}` : ''
  const { data: rawOcorrencias, refetch, isLoading } = useApiQuery<any[]>(
    ['ocorrencias', targetAlunoId],
    endpoint,
    undefined,
    { enabled: !!endpoint && !isOcorrenciasRestricted }
  )
  const ocorrencias = rawOcorrencias || []

  const queryClient = useQueryClient()

  useAgendaRealtime({
    table: 'ocorrencias',
    toastConfig: {
      enabled: true,
      insertMessage: () => `Nova ocorrência registrada!`,
      updateMessage: () => `Ocorrência atualizada!`,
      icon: <AlertTriangle size={18} color="#ef4444" />
    },
    onInsert: (payload) => {
      if (payload && payload.new) {
        queryClient.setQueryData(['ocorrencias', targetAlunoId], (old: any) => {
          if (!old) return [payload.new];
          return [payload.new, ...old];
        });
      }
    },
    onUpdate: (payload) => {
      if (payload && payload.new) {
        queryClient.setQueryData(['ocorrencias', targetAlunoId], (old: any) => {
          if (!old) return old;
          return old.map((item: any) => item.id === payload.new.id ? payload.new : item);
        });
      }
    },
    onDelete: (payload) => {
      if (payload && payload.old) {
        queryClient.setQueryData(['ocorrencias', targetAlunoId], (old: any) => {
          if (!old) return old;
          return old.filter((item: any) => item.id !== payload.old.id);
        });
      }
    }
  });

  const ocorrenciasDoAluno = useMemo(() => {
    const targetIdStr = String(targetAlunoId)
    return ocorrencias
      .filter(o => String(o.aluno_id) === targetIdStr || String(o.alunoId) === targetIdStr)
      .sort((a, b) => {
        const dateCompare = (b.data || '').localeCompare(a.data || '')
        if (dateCompare !== 0) return dateCompare
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [ocorrencias, targetAlunoId])

  const anosDisponiveis = useMemo(() => {
    const currentYear = String(new Date().getFullYear())
    const years = ocorrenciasDoAluno.map(o => o.ano || (o.data ? o.data.substring(0, 4) : currentYear))
    const uniqueYears = Array.from(new Set(years)).sort((a, b) => b.localeCompare(a))
    if (uniqueYears.length === 0) {
      uniqueYears.push(currentYear)
    }
    return uniqueYears
  }, [ocorrenciasDoAluno])

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !selectedYear) {
      setSelectedYear(anosDisponiveis[0])
    }
  }, [anosDisponiveis, selectedYear])

  // Auto-expand e scroll suave direto para a ocorrência da notificação push (?id=...)
  useEffect(() => {
    if (!queryItemId || hasAutoOpenedRef.current || ocorrenciasDoAluno.length === 0) return;

    const rawTarget = String(queryItemId).trim();
    const target = ocorrenciasDoAluno.find(o => String(o.id) === rawTarget);

    if (target) {
      hasAutoOpenedRef.current = true;
      const targetAno = target.ano || (target.data ? target.data.substring(0, 4) : '');
      if (targetAno && targetAno !== selectedYear) {
        setSelectedYear(targetAno);
      }
      setExpandedIds(prev => ({ ...prev, [target.id]: true }));
      setHighlightedId(String(target.id));

      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      const tryScroll = (attempts = 0) => {
        const el = document.getElementById(`ocorrencia-${target.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempts < 6) {
          retryTimer = setTimeout(() => tryScroll(attempts + 1), 150);
        }
      };

      const initTimer = setTimeout(() => tryScroll(0), 150);

      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 6000);
      return () => {
        clearTimeout(initTimer);
        if (retryTimer) clearTimeout(retryTimer);
        clearTimeout(timer);
      };
    }
  }, [queryItemId, ocorrenciasDoAluno, selectedYear]);

  const ocorrenciasFiltradas = useMemo(() => {
    if (!selectedYear) return []
    const fallbackYear = String(new Date().getFullYear())
    return ocorrenciasDoAluno.filter(o => {
      const ano = o.ano || (o.data ? o.data.substring(0, 4) : fallbackYear)
      return ano === selectedYear;
    })
  }, [ocorrenciasDoAluno, selectedYear])

  // Agrupamento O(N) com pré-computação dos campos de exibição fora do JSX
  const groupedOcorrencias = useMemo(() => {
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const map = new Map<string, any[]>()
    for (const o of ocorrenciasFiltradas) {
      const oDate = o.data || new Date(o.created_at).toISOString().split('T')[0]
      const lines = (o.descricao || '').split('\n')
      let lancado = ''
      const descLines: string[] = []
      for (const line of lines) {
        if (line.startsWith('[Lançado por:')) {
          lancado = line.replace('[Lançado por: ', '').replace(']', '')
        } else if (!line.startsWith('[Editado por:') && !line.startsWith('[Confirmado por:')) {
          descLines.push(line)
        }
      }
      const cleanedDesc = descLines.join('\n').trim()
      const textStr = cleanedDesc || o.descricao || ''
      const timeStr = o.created_at ? OCORRENCIA_TIME_FORMATTER.format(new Date(o.created_at)) : ''
      const dataStr = formatDateSeparatorCached(oDate || o.created_at, todayKey)
      const turmaStr = o.turmaNome || o.dados?.turma || aluno?.turma || '4º Ano A • Matutino'
      const autorStr = lancado ? lancado.split(' em ')[0] : (o.responsavel || 'Coordenação')

      const enriched = {
        ...o,
        _textStr: textStr,
        _timeStr: timeStr,
        _dataStr: dataStr,
        _turmaStr: turmaStr,
        _autorStr: autorStr
      }
      const list = map.get(oDate)
      if (list) list.push(enriched)
      else map.set(oDate, [enriched])
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
  }, [ocorrenciasFiltradas, aluno?.turma])

  useEffect(() => {
    if (!aluno?.id || ocorrenciasFiltradas.length === 0) return;

    const currentReaderId = currentUser?.id;
    if (!currentReaderId) return;

    if (isMirroring) return; // Do not mark as read in mirror mode

    const unreadIds = ocorrenciasFiltradas
      .filter(o => {
        const leituras = (o as any).dados?.leituras || (o as any).leituras || {};
        return !leituras[currentReaderId];
      })
      .map(o => o.id);

    if (unreadIds.length > 0) {
      const unreadSet = new Set(unreadIds);
      queryClient.setQueryData(['ocorrencias', targetAlunoId], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: any) => {
          if (!unreadSet.has(item.id)) return item;
          const prevLeituras = item.leituras || item.dados?.leituras || {};
          return {
            ...item,
            leituras: { ...prevLeituras, [currentReaderId]: true },
            dados: item.dados ? { ...item.dados, leituras: { ...prevLeituras, [currentReaderId]: true } } : item.dados
          };
        });
      });

      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'ocorrencia', ids: unreadIds, alunoId: aluno.id })
      })
      .then(res => {
        if (res.ok) window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
      })
      .catch(err => console.error(err));
    }
  }, [ocorrenciasFiltradas, aluno?.id, currentUser?.id, isMirroring, queryClient, targetAlunoId]);

  const handleAssinar = async (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return

    setSigningIds(prev => ({ ...prev, [id]: true }))
    
    const now = new Date()
    const dataHora = OCORRENCIA_DATETIME_DATE_FORMATTER.format(now) + ' às ' + OCORRENCIA_TIME_FORMATTER.format(now)
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
        refetch()
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

  if (isOcorrenciasRestricted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard
          title="Acesso Restrito"
          description="A visualização de ocorrências disciplinares está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px 100px 20px', minHeight: '100vh', background: 'transparent', fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      {/* Header aligned with the image */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#fef2f2', padding: 8, borderRadius: 10 }}>
            <FileText size={20} color="#f97316" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#0f172a' }}>Ocorrências</h1>
        </div>
        
        <button style={{ 
          background: '#fff', 
          border: '1px solid #e2e8f0', 
          borderRadius: 20, 
          padding: '8px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6,
          fontSize: 14,
          fontWeight: 600,
          color: '#475569',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <Filter size={14} /> Filtros <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {isLoading ? (
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
        <div
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            padding: '80px 40px',
            borderRadius: 32,
            textAlign: 'center',
            border: '1px solid rgba(226, 232, 240, 0.85)',
            boxShadow: '0 16px 32px rgba(15, 23, 42, 0.04)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'adFadeIn 0.25s ease'
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              position: 'relative',
              zIndex: 1,
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.14)'
            }}
          >
            <ShieldCheck size={40} color="#059669" strokeWidth={1.5} />
            <div
              style={{ position: 'absolute', inset: -10, border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '50%' }}
            />
            <div
              style={{ position: 'absolute', top: -4, right: -4, background: '#fff', borderRadius: '50%', padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              <Sparkles size={16} color="#10b981" />
            </div>
          </div>

          <h3
            style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}
          >
            Histórico Exemplar
          </h3>

          <p
            style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6, margin: 0, maxWidth: 400, position: 'relative', zIndex: 1 }}
          >
            Tudo certo por aqui! Não existem registros disciplinares ou de ocorrências para este aluno. Um excelente sinal de bom comportamento.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical continuous timeline line */}
          <div style={{ position: 'absolute', top: 26, bottom: 0, left: 14, width: 1, background: '#e2e8f0', zIndex: 0 }} />

          <div>
            {groupedOcorrencias.map((group) => (
              <div key={group.date}>
                {group.items.map((o) => {
                  const isConfirmada = !!o.ciencia_responsavel
                  const textStr = o._textStr
                  const isExpanded = !!expandedIds[o.id]
                  const maxLength = 100
                  const shouldTruncate = textStr.length > maxLength && !isExpanded
                  const displayText = shouldTruncate ? textStr.slice(0, maxLength).trim() + '...' : textStr

                  const timeStr = o._timeStr
                  const dataStr = o._dataStr
                  const turmaStr = o._turmaStr
                  const autorStr = o._autorStr

                  return (
                    <div
                      key={o.id}
                      id={`ocorrencia-${o.id}`}
                      style={{
                        position: 'relative',
                        paddingLeft: 38,
                        marginBottom: 20,
                        animation: 'adFadeIn 0.2s ease'
                      }}
                    >
                      {/* Timeline Dot centered on the vertical line (which is at left: 14px) */}
                      <div style={{ 
                        position: 'absolute', 
                        left: 14, 
                        top: 26, 
                        transform: 'translate(-50%, -50%)', 
                        zIndex: 2,
                        width: 22, 
                        height: 22, 
                        borderRadius: '50%', 
                        background: '#fff', 
                        border: '2.5px solid #8b5cf6',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 0 0 5px #fdfdfd'
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} />
                      </div>

                      {/* ============================================================ */}
                      {/* TIMELINE AURORA GLOW (Versão 4 Definitiva)                  */}
                      {/* ============================================================ */}
                      <div style={{
                        position: 'relative',
                        background: '#ffffff',
                        border: highlightedId === String(o.id) ? '2px solid #8b5cf6' : '1px solid rgba(216, 180, 254, 0.45)',
                        borderRadius: 24,
                        padding: '18px 20px',
                        boxShadow: highlightedId === String(o.id)
                          ? '0 0 0 4px rgba(139, 92, 246, 0.25), 0 20px 40px rgba(139, 92, 246, 0.2)'
                          : '0 16px 36px -6px rgba(168, 85, 247, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
                        overflow: 'hidden',
                        transition: 'all 0.4s ease'
                      }}>
                        {highlightedId === String(o.id) && (
                          <div style={{
                            position: 'absolute',
                            top: 10,
                            right: 14,
                            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                            color: '#ffffff',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 10px',
                            borderRadius: 999,
                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Sparkles size={11} />
                            Notificação
                          </div>
                        )}
                        {/* Aurora Glowing Accent Top Bar */}
                        <div style={{
                          position: 'absolute', top: 0, left: 16, right: 16, height: 4,
                          borderRadius: '0 0 4px 4px',
                          background: 'linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6)'
                        }} />

                        {/* Card Header: Status Badge + Title + Time + Collapse */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 }}>
                          <div>
                            <span style={{ 
                              fontSize: 10, 
                              fontWeight: 800, 
                              textTransform: 'uppercase', 
                              padding: '2.5px 8.5px', 
                              borderRadius: 999, 
                              background: isConfirmada ? '#ecfdf5' : '#fef3c7', 
                              color: isConfirmada ? '#059669' : '#d97706', 
                              border: isConfirmada ? '1px solid #a7f3d0' : '1px solid #fde68a',
                              letterSpacing: '0.04em'
                            }}>
                              {isConfirmada ? 'Ciência Confirmada' : 'Aguardando Ciência'}
                            </span>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 0 0', color: '#0f172a', letterSpacing: '-0.01em' }}>
                              Ocorrência Disciplinar
                            </h3>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ 
                              fontSize: 11.5, 
                              fontWeight: 700, 
                              color: '#7c3aed', 
                              background: '#f3e8ff', 
                              padding: '4px 10px', 
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Calendar size={11} color="#7c3aed" />
                              {dataStr}
                            </span>

                            <span style={{ 
                              fontSize: 11.5, 
                              fontWeight: 700, 
                              color: '#7c3aed', 
                              background: '#f3e8ff', 
                              padding: '4px 10px', 
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Clock size={11} color="#7c3aed" />
                              {timeStr}
                            </span>

                            <div 
                              onClick={() => setCollapsedIds(p => ({ ...p, [o.id]: !p[o.id] }))}
                              style={{ 
                                width: 28, 
                                height: 28, 
                                borderRadius: '50%', 
                                background: '#f8fafc', 
                                border: '1px solid #e2e8f0', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                cursor: 'pointer', 
                                color: '#64748b' 
                              }}
                            >
                              <svg style={{ transform: collapsedIds[o.id] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                          </div>
                        </div>

                        {!collapsedIds[o.id] && (
                          <div style={{ animation: 'adFadeIn 0.15s ease' }}>
                            {/* Floating Aurora Badges: Turma & Autor */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                              <span style={{ 
                                background: '#fdf4ff', 
                                border: '1px solid #f0abfc', 
                                color: '#86198f', 
                                fontSize: 11.5, 
                                fontWeight: 700, 
                                padding: '4px 10px', 
                                borderRadius: 10, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 5 
                              }}>
                                <GraduationCap size={13} color="#a21caf" />
                                {turmaStr}
                              </span>

                              <span style={{ 
                                background: '#f8fafc', 
                                border: '1px solid #e2e8f0', 
                                color: '#334155', 
                                fontSize: 11.5, 
                                fontWeight: 600, 
                                padding: '4px 10px', 
                                borderRadius: 10, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 5 
                              }}>
                                <User size={13} color="#64748b" />
                                {autorStr}
                              </span>
                            </div>

                            {/* Motivo / Descrição Pedagógica com Aurora Glow sutil */}
                            <div style={{ 
                              background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)', 
                              border: '1px solid #f3e8ff', 
                              borderRadius: 14, 
                              padding: '12px 14px', 
                              marginBottom: 16, 
                              fontSize: 13, 
                              color: '#475569', 
                              lineHeight: 1.6 
                            }}>
                              <strong style={{ color: '#581c87', display: 'block', fontSize: 11, marginBottom: 3 }}>
                                Relato Pedagógico:
                              </strong>
                              <p style={{ margin: 0 }}>
                                {displayText}
                                {shouldTruncate && (
                                  <span 
                                    onClick={() => setExpandedIds(p => ({...p, [o.id]: true}))} 
                                    style={{ color: '#7c3aed', fontWeight: 700, cursor: 'pointer', marginLeft: 4 }}
                                  >
                                    Ver mais
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Botão de Assinar Ciência com Gradiente Aurora */}
                            {!isMirroring && (!isAlunoLogado || o.ciencia_responsavel) && (
                              <button 
                                onClick={() => !o.ciencia_responsavel && !isAlunoLogado && handleAssinar(o.id)}
                                disabled={!!signingIds[o.id] || o.ciencia_responsavel || isAlunoLogado}
                                style={{ 
                                  width: '100%', 
                                  height: 44,
                                  borderRadius: 14, 
                                  border: o.ciencia_responsavel ? '1px solid #a7f3d0' : 'none', 
                                  background: o.ciencia_responsavel ? '#ecfdf5' : 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #f59e0b 100%)', 
                                  color: o.ciencia_responsavel ? '#059669' : '#ffffff', 
                                  fontWeight: 800, 
                                  fontSize: 13.5, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  gap: 8,
                                  cursor: (signingIds[o.id] || o.ciencia_responsavel) ? 'default' : 'pointer',
                                  boxShadow: o.ciencia_responsavel ? 'none' : '0 8px 20px rgba(124, 58, 237, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.35)'
                                }}
                              >
                                {signingIds[o.id] ? (
                                  <Loader2 size={16} className="spin-animation" />
                                ) : (
                                  <Check size={16} strokeWidth={3} />
                                )}
                                {o.ciencia_responsavel ? 'Ciência Registrada' : 'Assinar Ciência'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}



      <style>{`
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
