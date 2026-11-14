'use client'

import React, { useState, useMemo } from 'react'
import {
  History,
  X,
  RotateCcw,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Calendar,
  Clock,
  Filter,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import {
  MovimentacaoLog,
  TipoAcaoMovimentacao,
  formatDataHoraBR,
  formatTempoRelativoBR,
  parseConfigEstudio,
  getTeacherInitials,
  formatTeacherShortName
} from '@/lib/simuladosLogs'

interface HistoricoMovimentacoesModalProps {
  isOpen: boolean
  onClose: () => void
  avaliacao: any
  tipo?: 'prova' | 'simulado' | 'redacao'
  initialReqId?: string | null
}

export function HistoricoMovimentacoesModal({
  isOpen,
  onClose,
  avaliacao,
  tipo = 'prova',
  initialReqId = null
}: HistoricoMovimentacoesModalProps) {
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>(initialReqId || 'todas')
  const [filtroTipo, setFiltroTipo] = useState<string>('todas')

  if (!isOpen || !avaliacao) return null

  const configEstudio = parseConfigEstudio(avaliacao.config_estudio)
  const rawLogs: MovimentacaoLog[] = Array.isArray(configEstudio.historico_movimentacoes)
    ? configEstudio.historico_movimentacoes
    : []

  const reqs: any[] = Array.isArray(avaliacao.provas_upload_requisicoes)
    ? avaliacao.provas_upload_requisicoes
    : Array.isArray(avaliacao.simulados_upload_requisicoes)
      ? avaliacao.simulados_upload_requisicoes
      : []

  // Mapeamento de disciplinas disponíveis para os filtros
  const disciplinasDisponiveis = useMemo(() => {
    const list: { id: string; nome: string }[] = []
    reqs.forEach((r: any) => {
      const nome = r.disciplina_nome || 'Geral'
      if (!list.some(d => d.id === r.id || d.nome.toLowerCase() === nome.toLowerCase())) {
        list.push({ id: r.id, nome })
      }
    })
    return list
  }, [reqs])

  // Logs filtrados
  const logsFiltrados = useMemo(() => {
    return rawLogs.filter((log) => {
      if (filtroDisciplina !== 'todas') {
        const matchesId = log.id_requisicao === filtroDisciplina
        const matchesNome =
          log.disciplina_nome &&
          disciplinasDisponiveis.some(
            d => d.id === filtroDisciplina && d.nome.toLowerCase() === log.disciplina_nome?.toLowerCase()
          )
        if (!matchesId && !matchesNome) return false
      }
      if (filtroTipo !== 'todas' && log.acao !== filtroTipo) {
        return false
      }
      return true
    })
  }, [rawLogs, filtroDisciplina, filtroTipo, disciplinasDisponiveis])

  // Cores e ícones semânticos para cada tipo de ação
  const getActionVisual = (acao: TipoAcaoMovimentacao) => {
    switch (acao) {
      case 'reabrir':
        return {
          icon: RotateCcw,
          color: '#d97706',
          dot: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.35)',
          badgeLabel: 'Reabertura'
        }
      case 'enviar':
        return {
          icon: Send,
          color: '#2563eb',
          dot: '#3b82f6',
          bg: 'rgba(37, 99, 235, 0.12)',
          border: 'rgba(37, 99, 235, 0.35)',
          badgeLabel: 'Envio'
        }
      case 'aprovar':
      case 'publicar':
        return {
          icon: CheckCircle2,
          color: '#059669',
          dot: '#10b981',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.35)',
          badgeLabel: 'Aprovação'
        }
      case 'devolver':
        return {
          icon: XCircle,
          color: '#dc2626',
          dot: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.35)',
          badgeLabel: 'Devolução'
        }
      case 'criar':
      default:
        return {
          icon: Sparkles,
          color: '#7c3aed',
          dot: '#8b5cf6',
          bg: 'rgba(139, 92, 246, 0.12)',
          border: 'rgba(139, 92, 246, 0.35)',
          badgeLabel: 'Registro'
        }
    }
  }

  const formatStatusLabel = (s?: string) => {
    if (!s) return '—'
    const map: Record<string, string> = {
      pendente: 'Em elaboração (Rascunho)',
      enviado: 'Em revisão',
      em_revisao: 'Em revisão',
      aprovado: 'Concluída / Aprovada',
      reprovado: 'Devolvida',
      rejeitado: 'Devolvida',
      publicado: 'Publicada',
      aguardando: 'Aguardando'
    }
    return map[s] || s
  }

  const getStatusBadgeStyle = (s?: string) => {
    if (!s) return { color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' }
    if (s === 'aprovado' || s === 'publicado' || s === 'concluido') {
      return { color: '#059669', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' }
    }
    if (s === 'enviado' || s === 'em_revisao') {
      return { color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', border: 'rgba(37, 99, 235, 0.25)' }
    }
    if (s === 'reprovado' || s === 'rejeitado') {
      return { color: '#dc2626', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' }
    }
    return { color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-historico-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        .historico-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .historico-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .historico-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .historico-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .btn-filter-pill {
          transition: all 0.15s ease;
        }
        .btn-filter-pill:hover {
          transform: translateY(-1px);
        }
        .btn-modal-close {
          transition: all 0.15s ease;
        }
        .btn-modal-close:hover {
          background: rgba(239, 68, 68, 0.1) !important;
          color: #ef4444 !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          transform: translateY(-1px);
        }
        .btn-modal-footer-close {
          transition: all 0.15s ease;
        }
        .btn-modal-footer-close:hover {
          background: #e2e8f0 !important;
          color: #0f172a !important;
          transform: translateY(-1px);
        }
      `}</style>

      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: 820,
          maxHeight: '88vh',
          borderRadius: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25), 0 10px 30px -10px rgba(15, 23, 42, 0.1)',
          border: '1px solid #e2e8f0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)'
              }}
            >
              <History size={22} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2
                  id="modal-historico-title"
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: 0,
                    letterSpacing: '-0.02em'
                  }}
                >
                  Histórico de Movimentações & Auditoria
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    fontSize: 10.5,
                    fontWeight: 800,
                    background: 'rgba(124, 58, 237, 0.08)',
                    color: '#7c3aed',
                    border: '1px solid rgba(124, 58, 237, 0.2)'
                  }}
                >
                  <ShieldCheck size={11} /> Rastreamento Ativo
                </span>
              </div>
              <p
                style={{
                  color: '#64748b',
                  margin: '3px 0 0',
                  fontSize: 12.5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {avaliacao.titulo || 'Avaliação sem título'} • {avaliacao.series || 'Turma'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Fechar histórico"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Filtros Rápidos */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          {/* Filtro por disciplina */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginRight: 4
              }}
            >
              Disciplina:
            </span>
            <button
              type="button"
              className="btn-filter-pill"
              onClick={() => setFiltroDisciplina('todas')}
              style={{
                padding: '4px 11px',
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                border:
                  filtroDisciplina === 'todas'
                    ? '1px solid #7c3aed'
                    : '1px solid #cbd5e1',
                background:
                  filtroDisciplina === 'todas' ? '#7c3aed' : '#ffffff',
                color: filtroDisciplina === 'todas' ? '#ffffff' : '#475569',
                boxShadow: filtroDisciplina === 'todas' ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none'
              }}
            >
              Todas ({rawLogs.length})
            </button>
            {disciplinasDisponiveis.map((d) => {
              const isActive = filtroDisciplina === d.id || filtroDisciplina === d.nome
              const count = rawLogs.filter(
                (l) => l.id_requisicao === d.id || l.disciplina_nome?.toLowerCase() === d.nome.toLowerCase()
              ).length
              return (
                <button
                  key={d.id}
                  type="button"
                  className="btn-filter-pill"
                  onClick={() => setFiltroDisciplina(isActive ? 'todas' : d.id)}
                  style={{
                    padding: '4px 11px',
                    borderRadius: 9999,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: isActive
                      ? '1px solid #7c3aed'
                      : '1px solid #cbd5e1',
                    background: isActive ? '#7c3aed' : '#ffffff',
                    color: isActive ? '#ffffff' : '#475569',
                    boxShadow: isActive ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none'
                  }}
                >
                  {d.nome} {count > 0 ? `(${count})` : ''}
                </button>
              )
            })}
          </div>

          {/* Filtro por tipo de ação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Ação:
            </span>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                background: '#ffffff',
                color: '#1e293b',
                border: '1px solid #cbd5e1',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
              }}
            >
              <option value="todas">Todas as ações</option>
              <option value="reabrir">Reaberturas</option>
              <option value="enviar">Envios para Revisão</option>
              <option value="aprovar">Aprovações</option>
              <option value="devolver">Devoluções</option>
            </select>
          </div>
        </div>

        {/* Lista / Timeline de Movimentações */}
        <div
          className="historico-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: '#f8fafc'
          }}
        >
          {logsFiltrados.length === 0 ? (
            /* Card informativo caso não haja registros detalhados gravados ainda */
            <div
              style={{
                padding: '32px 24px',
                borderRadius: 16,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 14,
                boxShadow: '0 4px 16px -4px rgba(15, 23, 42, 0.06)'
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: 'rgba(124, 58, 237, 0.08)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7c3aed'
                }}
              >
                <Clock size={26} />
              </div>
              <div>
                <h4
                  style={{
                    fontSize: 15.5,
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: 0
                  }}
                >
                  Nenhuma movimentação detalhada registrada ainda
                </h4>
                <p
                  style={{
                    fontSize: 12.5,
                    color: '#64748b',
                    margin: '6px 0 0',
                    maxWidth: 480,
                    lineHeight: 1.5
                  }}
                >
                  O sistema de auditoria está ativo para esta avaliação. Todas as ações de{' '}
                  <strong style={{ color: '#0f172a' }}>reabertura</strong>,{' '}
                  <strong style={{ color: '#0f172a' }}>envio</strong>,{' '}
                  <strong style={{ color: '#0f172a' }}>aprovação</strong> e{' '}
                  <strong style={{ color: '#0f172a' }}>devolução</strong> passarão a ser gravadas com data, horário, responsável e
                  perfil em tempo real.
                </p>
              </div>

              {/* Registro sintético de criação da avaliação */}
              <div
                style={{
                  marginTop: 6,
                  width: '100%',
                  maxWidth: 480,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="#7c3aed" />
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    Criada por: {avaliacao.criado_por_nome || 'Autor da Avaliação'}
                  </span>
                </div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>
                  {formatDataHoraBR(avaliacao.created_at)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Linha vertical contínua da timeline */}
              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  top: 14,
                  bottom: 14,
                  width: 2,
                  background: '#e2e8f0',
                  zIndex: 0
                }}
              />

              {logsFiltrados.map((log, idx) => {
                const visual = getActionVisual(log.acao)
                const IconComponent = visual.icon
                const tempoRelativo = formatTempoRelativoBR(log.data_hora)

                return (
                  <div
                    key={log.id || idx}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14
                    }}
                  >
                    {/* Nó / Ícone na timeline */}
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: `2.5px solid ${visual.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 3px 10px rgba(0, 0, 0, 0.08)`
                      }}
                      title={visual.badgeLabel}
                    >
                      <IconComponent size={18} color={visual.color} />
                    </div>

                    {/* Card de detalhes do evento */}
                    <div
                      style={{
                        flex: 1,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${visual.color}`,
                        borderRadius: 14,
                        padding: '14px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.03)'
                      }}
                    >
                      {/* Topo do card: Título da ação + Tags */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: 13.5,
                              fontWeight: 800,
                              color: '#0f172a'
                            }}
                          >
                            {log.titulo_acao}
                          </span>

                          {log.disciplina_nome && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: '#4f46e5',
                                border: '1px solid rgba(99, 102, 241, 0.25)'
                              }}
                            >
                              {log.disciplina_nome}
                            </span>
                          )}

                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 9999,
                              fontSize: 10.5,
                              fontWeight: 800,
                              background: visual.bg,
                              color: visual.color,
                              border: `1px solid ${visual.border}`
                            }}
                          >
                            {visual.badgeLabel}
                          </span>
                        </div>

                        {/* Data e hora exatas */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11.5,
                            color: '#64748b',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          <Calendar size={13} />
                          <span>{formatDataHoraBR(log.data_hora)}</span>
                          {tempoRelativo && (
                            <span style={{ opacity: 0.85 }}>({tempoRelativo})</span>
                          )}
                        </div>
                      </div>

                      {/* Transição de Status se houver */}
                      {(log.status_anterior || log.status_novo) && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                            width: 'fit-content'
                          }}
                        >
                          <span style={{ color: '#64748b', fontWeight: 600 }}>
                            Mudança de Status:
                          </span>
                          {log.status_anterior && (
                            <span
                              style={{
                                ...getStatusBadgeStyle(log.status_anterior),
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontWeight: 700
                              }}
                            >
                              {formatStatusLabel(log.status_anterior)}
                            </span>
                          )}
                          <ArrowRight size={13} color="#94a3b8" />
                          <span
                            style={{
                              ...getStatusBadgeStyle(log.status_novo),
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontWeight: 700
                            }}
                          >
                            {formatStatusLabel(log.status_novo)}
                          </span>
                        </div>
                      )}

                      {/* Observações adicionais */}
                      {log.observacao && (
                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: '#f8fafc',
                            borderLeft: `3px solid ${visual.color}`,
                            fontSize: 12,
                            color: '#334155'
                          }}
                        >
                          <strong style={{ color: '#0f172a' }}>Observação:</strong> {log.observacao}
                        </div>
                      )}

                      {/* Rodapé do card: Quem realizou a ação */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          paddingTop: 8,
                          borderTop: '1px solid #f1f5f9',
                          fontSize: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                              color: '#ffffff',
                              fontSize: 10,
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {getTeacherInitials(log.usuario_nome)}
                          </div>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {formatTeacherShortName(log.usuario_nome)}
                          </span>
                          {log.usuario_perfil && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontSize: 10.5,
                                fontWeight: 700,
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              {log.usuario_perfil}
                            </span>
                          )}
                        </div>

                        {log.professor_nome && log.professor_nome !== log.usuario_nome && (
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            Professor atribuído: <strong style={{ color: '#334155' }}>{formatTeacherShortName(log.professor_nome)}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f1f5f9',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              color: '#64748b'
            }}
          >
            <ShieldCheck size={14} color="#10b981" />
            <span>Registros gravados e imutáveis para conformidade institucional.</span>
          </div>

          <button
            type="button"
            className="btn-modal-footer-close"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#334155',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
