'use client'

import React, { useState, useEffect } from 'react'
import {
  X, CheckCircle2, AlertTriangle, Clock, Smartphone,
  ExternalLink, Copy, Check, Radio, Eye, RefreshCw, Send,
  Layers, Info, ShieldCheck, Laptop, Apple, User, Users,
  GraduationCap, Briefcase, Mail, Phone, ChevronDown, ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'

export interface RecipientItem {
  id: string
  nome: string
  tipo: 'responsavel' | 'aluno' | 'colaborador'
  tipoLabel: string
  email?: string | null
  telefone?: string | null
  matricula?: string | null
  turmaNome?: string | null
  cargo?: string | null
  devicesCount?: number
  devices?: any[]
  hasActiveDevice?: boolean
  deviceSummary?: string
  accountStatus?: 'active_device' | 'never_activated' | 'no_email' | 'no_device'
  accountStatusLabel?: string
  accountStatusDetail?: string
  statusTone?: 'success' | 'warning' | 'danger' | 'neutral'
}

interface PushHistoryDetailModalProps {
  log: any | null
  onClose: () => void
  onResend?: (log: any) => void
}

export function PushHistoryDetailModal({
  log,
  onClose,
  onResend,
}: PushHistoryDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [liveStats, setLiveStats] = useState<any | null>(null)
  const [isLoadingLiveStats, setIsLoadingLiveStats] = useState(false)

  // Detalhes completos dos destinatários e leitura
  const [detailsData, setDetailsData] = useState<{
    recipients: RecipientItem[]
    summary: string
    targetAliases: string[]
    targetCount: number
    readInfo: { isRead: boolean; readAt: string | null; readBy: string | null; readerName: string | null }
    oneSignalStats?: any
  } | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [showTechnicalAliases, setShowTechnicalAliases] = useState(false)

  // Extrair ID do OneSignal do JSON armazenado no log
  const oneSignalId = log?.oneSignalId || (() => {
    try {
      if (log?.onesignal_response) {
        const p = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
        return p?.id || null
      }
    } catch {}
    return null
  })()

  // Buscar detalhes dos destinatários e leitura
  useEffect(() => {
    if (!log?.id) {
      setDetailsData(null)
      return
    }

    let isMounted = true
    setIsLoadingDetails(true)

    fetch(`/api/agenda/push/test?log_details=${encodeURIComponent(log.id)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data) {
          setDetailsData(data)
          if (data.oneSignalStats) {
            setLiveStats(data.oneSignalStats)
          }
        }
      })
      .catch(err => {
        console.warn('Erro ao carregar detalhes dos destinatários:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoadingDetails(false)
      })

    return () => { isMounted = false }
  }, [log?.id])

  // Buscar estatísticas em tempo real na API do OneSignal se houver ID
  const fetchLiveStats = async () => {
    if (!oneSignalId) return
    setIsLoadingLiveStats(true)
    try {
      const res = await fetch(`/api/agenda/push/test?notification_stats=${encodeURIComponent(oneSignalId)}`)
      if (res.ok) {
        const data = await res.json()
        setLiveStats(data.stats || null)
      }
    } catch (e) {
      console.warn('Erro ao consultar estatísticas do OneSignal:', e)
    } finally {
      setIsLoadingLiveStats(false)
    }
  }

  useEffect(() => {
    if (log && oneSignalId && !detailsData?.oneSignalStats) {
      fetchLiveStats()
    }
  }, [log, oneSignalId, detailsData])

  if (!log) return null

  const isSuccess = log.status === 'sent'
  const isFailed = log.status === 'failed'

  const effectiveIsRead = Boolean(detailsData?.readInfo?.isRead ?? log.isRead)
  const effectiveReadAt = detailsData?.readInfo?.readAt || log.readAt
  const effectiveReaderName = detailsData?.readInfo?.readerName || null

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('Copiado para a área de transferência!')
    setTimeout(() => setCopiedField(null), 2000)
  }

  const recipientsList = detailsData?.recipients || []
  const targetAliasesList = detailsData?.targetAliases || []

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 22,
          maxWidth: 680,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'hsl(var(--bg-main))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isSuccess ? (
                <CheckCircle2 size={22} color="#10b981" />
              ) : (
                <AlertTriangle size={22} color="#ef4444" />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                  Auditoria de Notificação Push
                </h3>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: isSuccess ? '#059669' : '#dc2626',
                  border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}>
                  {isSuccess ? 'Enviado' : 'Falha'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Log ID: <code>{log.id}</code></span>
                <button
                  onClick={() => copyToClipboard(log.id, 'logId')}
                  style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 0 }}
                  title="Copiar ID do Log"
                >
                  {copiedField === 'logId' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'hsl(var(--bg-main))',
              border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 10,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'hsl(var(--text-muted))',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div style={{
          padding: 24,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          {/* Card de Notificação Exibida */}
          <div style={{
            background: 'hsl(var(--bg-main))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 16,
            padding: 16,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={12} /> Notificação Exibida no Celular
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
              {log.title}
            </div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-main))', lineHeight: 1.5 }}>
              {log.message}
            </div>

            {log.target_url && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'hsl(var(--text-muted))' }}>Ao tocar, abre a rota:</span>
                <a
                  href={log.target_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  <code style={{ fontSize: 11 }}>{log.target_url.replace(/^https?:\/\/[^/]+/, '') || log.target_url}</code>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>

          {/* Cards de Resumo: Data, Destinatários e Leitura no App */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {/* Card 1: Data e Horário */}
            <div style={{
              padding: 14,
              borderRadius: 14,
              background: 'hsl(var(--bg-main))',
              border: '1px solid hsl(var(--border-subtle))',
            }}>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Data e Horário do Envio</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#6366f1" />
                {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
              </div>
            </div>

            {/* Card 2: Destinatários Alvejados */}
            <div style={{
              padding: 14,
              borderRadius: 14,
              background: 'hsl(var(--bg-main))',
              border: '1px solid hsl(var(--border-subtle))',
            }}>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={12} color="#6366f1" /> Destinatários Alvejados
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>
                {detailsData?.recipients?.length || log.target_count || 1} destinatário(s)
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {detailsData?.summary || `${log.target_count || 1} alvos na lista`}
              </div>
            </div>

            {/* Card 3: Confirmação de Leitura no App (App Aberto) */}
            <div style={{
              padding: 14,
              borderRadius: 14,
              background: effectiveIsRead ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.06)',
              border: `1px solid ${effectiveIsRead ? '#10b981' : 'rgba(245, 158, 11, 0.25)'}`,
            }}>
              <div style={{ fontSize: 11, color: effectiveIsRead ? '#059669' : '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Eye size={12} /> Confirmação de Leitura no App
              </div>
              <div style={{
                fontSize: 13,
                fontWeight: 800,
                marginTop: 4,
                color: effectiveIsRead ? '#059669' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                {effectiveIsRead ? '🟢 Lido no aplicativo' : '🟡 Aguardando leitura'}
              </div>
              <div style={{ fontSize: 11, color: effectiveIsRead ? '#047857' : 'hsl(var(--text-muted))', marginTop: 2 }}>
                {effectiveIsRead ? (
                  <span>
                    Lido em {new Date(effectiveReadAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {effectiveReaderName ? ` por ${effectiveReaderName}` : ''}
                  </span>
                ) : (
                  'Ainda não visualizado no app pelo responsável'
                )}
              </div>
            </div>
          </div>

          {/* Seção Detalhada: Lista de Quem São os Destinatários */}
          <div style={{
            background: 'hsl(var(--bg-main))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 16,
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#6366f1" />
                <span style={{ fontSize: 13, fontWeight: 800 }}>Destinatários do Disparo</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: '#6366f1',
                  padding: '1px 7px',
                  borderRadius: 6
                }}>
                  {recipientsList.length > 0 ? recipientsList.length : (log.target_count || 1)}
                </span>
              </div>

              {targetAliasesList.length > 0 && (
                <button
                  onClick={() => setShowTechnicalAliases(!showTechnicalAliases)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {showTechnicalAliases ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showTechnicalAliases ? 'Ocultar IDs do OneSignal' : `Ver IDs OneSignal (${targetAliasesList.length})`}
                </button>
              )}
            </div>

            {isLoadingDetails ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Carregando destinatários e dados de vínculo...
              </div>
            ) : recipientsList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recipientsList.map((rec, index) => {
                  const isAluno = rec.tipo === 'aluno'
                  const isResp = rec.tipo === 'responsavel'
                  const isColab = rec.tipo === 'colaborador'

                  return (
                    <div
                      key={rec.id + '-' + index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-subtle))',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          background: isAluno ? 'rgba(59, 130, 246, 0.12)' : isResp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                          color: isAluno ? '#3b82f6' : isResp ? '#10b981' : '#8b5cf6',
                        }}>
                          {isAluno ? <GraduationCap size={16} /> : isResp ? <Users size={16} /> : <Briefcase size={16} />}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-main))' }}>
                              {rec.nome}
                            </span>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: isAluno ? 'rgba(59, 130, 246, 0.1)' : isResp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                              color: isAluno ? '#2563eb' : isResp ? '#059669' : '#7c3aed',
                            }}>
                              {rec.tipoLabel}
                            </span>
                          </div>

                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            {isAluno && (
                              <span>Matrícula: {rec.matricula} {rec.turmaNome ? `• ${rec.turmaNome}` : ''}</span>
                            )}
                            {rec.email && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Mail size={10} /> {rec.email}
                              </span>
                            )}
                            {rec.telefone && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Phone size={10} /> {rec.telefone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status de Entrega do Usuário */}
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        {isAluno ? (
                          <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                            Alvo do Disparo
                          </span>
                        ) : rec.hasActiveDevice ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                              🟢 Push Ativo
                            </span>
                            {rec.deviceSummary && (
                              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                                {rec.deviceSummary}
                              </span>
                            )}
                          </div>
                        ) : rec.accountStatus === 'no_email' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              ⚪ Sem E-mail
                            </span>
                            <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                              Pendente cadastro na secretaria
                            </span>
                          </div>
                        ) : rec.accountStatus === 'never_activated' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                              🟡 Conta Não Ativada
                            </span>
                            <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                              Nunca fez o 1º Acesso no app
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                              🔴 Sem Aparelho Ativo
                            </span>
                            <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                              App desinstalado ou sem permissão
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', padding: '8px 0' }}>
                Disparo direcionado para {log.target_count || 1} usuário(s) na lista de distribuição.
              </div>
            )}

            {/* Gaveta de Identificadores Técnicos OneSignal */}
            {showTechnicalAliases && targetAliasesList.length > 0 && (
              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid hsl(var(--border-subtle))',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>
                  Identificadores Brutos OneSignal (External IDs & Aliases alvejados):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {targetAliasesList.map((alias, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 10,
                        fontFamily: 'monospace',
                        background: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-subtle))',
                        borderRadius: 6,
                        padding: '3px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{alias}</span>
                      <button
                        onClick={() => copyToClipboard(alias, `alias-${i}`)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 0 }}
                        title="Copiar alias"
                      >
                        {copiedField === `alias-${i}` ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Telemetria ao Vivo do OneSignal */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 16,
            padding: 18,
            color: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={16} color="#38bdf8" />
                <span style={{ fontSize: 13, fontWeight: 800 }}>Métricas de Entrega OneSignal (Gateway Push)</span>
              </div>

              {oneSignalId && (
                <button
                  onClick={fetchLiveStats}
                  disabled={isLoadingLiveStats}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8,
                    padding: '4px 10px',
                    color: '#e2e8f0',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <RefreshCw size={11} style={isLoadingLiveStats ? { animation: 'spin 1s linear infinite' } : {}} />
                  {isLoadingLiveStats ? 'Atualizando...' : 'Recarregar'}
                </button>
              )}
            </div>

            {oneSignalId ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontSize: 11, color: '#94a3b8' }}>
                  <span>Notification UUID: <code style={{ color: '#38bdf8' }}>{oneSignalId}</code></span>
                  <button
                    onClick={() => copyToClipboard(oneSignalId, 'oneSignalId')}
                    style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    {copiedField === 'oneSignalId' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    Copiar ID
                  </button>
                </div>

                {liveStats ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div style={{ padding: 10, borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Aparelhos Entregues</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                        {liveStats.successful ?? 0}
                      </div>
                      {liveStats.platform_delivery_stats ? (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                          {liveStats.platform_delivery_stats.ios?.successful || 0} iOS • {liveStats.platform_delivery_stats.android?.successful || 0} Android
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                          Sinal entregue aos aparelhos
                        </div>
                      )}
                    </div>

                    <div style={{ padding: 10, borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Cliques / Aberturas</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa', marginTop: 2 }}>
                        {liveStats.converted ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: (liveStats.converted || 0) > 0 ? '#60a5fa' : '#94a3b8', marginTop: 4 }}>
                        {(liveStats.converted || 0) > 0 ? 'Toques diretos no push' : 'Abertos direto pelo push'}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Falhas / Erros</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: (liveStats.failed || 0) > 0 ? '#f87171' : '#94a3b8', marginTop: 2 }}>
                        {liveStats.failed ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                        Desconectados / Bloqueados
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#94a3b8', padding: '10px 0' }}>
                    {isLoadingLiveStats ? 'Consultando status em tempo real com o OneSignal...' : 'Clique em "Recarregar" para buscar telemetria ao vivo.'}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                {log.status === 'failed'
                  ? 'Este disparo foi rejeitado antes de gerar um ID no OneSignal (provavelmente nenhum usuário inscrito com permissão ativa).'
                  : 'Disparo efetuado em modo simulado ou sem ID registrado.'}
              </div>
            )}
          </div>

          {/* Diagnóstico de Erro (se houver) */}
          {log.error_message && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 14,
              padding: 16,
              color: '#dc2626',
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Diagnóstico de Erro
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                {log.error_message.includes('All included players are not subscribed')
                  ? 'Nenhum dos aparelhos deste destinatário está atualmente com a notificação push autorizada. O usuário pode ter desinstalado o app, negado a permissão nas configurações do iOS/Android ou o token expirou.'
                  : log.error_message}
              </div>
            </div>
          )}

          {/* Resposta Técnica do OneSignal (JSON) */}
          {log.onesignal_response && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                  Resposta Bruta da API (Auditoria Técnica)
                </span>
                <button
                  onClick={() => copyToClipboard(typeof log.onesignal_response === 'string' ? log.onesignal_response : JSON.stringify(log.onesignal_response, null, 2), 'rawResponse')}
                  style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
                >
                  {copiedField === 'rawResponse' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  Copiar JSON
                </button>
              </div>
              <pre style={{
                background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 12,
                padding: 12,
                fontSize: 11,
                fontFamily: 'monospace',
                overflowX: 'auto',
                maxHeight: 180,
                color: 'hsl(var(--text-main))',
              }}>
                {(() => {
                  try {
                    return JSON.stringify(typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response, null, 2)
                  } catch {
                    return String(log.onesignal_response)
                  }
                })()}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid hsl(var(--border-subtle))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'hsl(var(--bg-main))',
        }}>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
          >
            Fechar
          </button>

          {onResend && (
            <button
              onClick={() => onResend(log)}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#6366f1',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 10,
              }}
            >
              <Send size={14} /> Reenviar Notificação Novamente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
