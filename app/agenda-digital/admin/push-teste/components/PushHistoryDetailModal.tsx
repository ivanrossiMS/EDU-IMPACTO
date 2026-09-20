'use client'

import React, { useState, useEffect } from 'react'
import {
  X, CheckCircle2, AlertTriangle, Clock, Smartphone,
  ExternalLink, Copy, Check, Radio, Eye, RefreshCw, Send,
  Layers, Info, ShieldCheck, Laptop, Apple
} from 'lucide-react'
import { toast } from 'sonner'

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
    if (log && oneSignalId) {
      fetchLiveStats()
    } else {
      setLiveStats(null)
    }
  }, [log, oneSignalId])

  if (!log) return null

  const isSuccess = log.status === 'sent'
  const isFailed = log.status === 'failed'

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('Copiado para a área de transferência!')
    setTimeout(() => setCopiedField(null), 2000)
  }

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
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
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
                <CheckCircle2 size={24} color="#10b981" />
              ) : (
                <AlertTriangle size={24} color="#ef4444" />
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
                  padding: '2px 8px',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                  background: isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: isSuccess ? '#059669' : '#dc2626',
                }}>
                  {isSuccess ? 'Enviado' : 'Falha'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                Log ID: <code style={{ fontSize: 10 }}>{log.id}</code>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'hsl(var(--text-muted))',
              padding: 6,
              borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* Card de Conteúdo da Mensagem */}
          <div style={{
            background: 'hsl(var(--bg-main))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 14,
            padding: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>
              Notificação Exibida no Celular
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

          {/* Status de Entrega & Confirmação de Leitura */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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

            <div style={{
              padding: 14,
              borderRadius: 14,
              background: 'hsl(var(--bg-main))',
              border: '1px solid hsl(var(--border-subtle))',
            }}>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Destinatários Alvejados</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                {log.target_count || 1} usuário(s) na lista
              </div>
            </div>

            <div style={{
              padding: 14,
              borderRadius: 14,
              background: log.isRead ? 'rgba(16, 185, 129, 0.08)' : 'hsl(var(--bg-main))',
              border: `1px solid ${log.isRead ? '#10b981' : 'hsl(var(--border-subtle))'}`,
            }}>
              <div style={{ fontSize: 11, color: log.isRead ? '#059669' : 'hsl(var(--text-muted))', fontWeight: 700 }}>
                Confirmação de Abertura / Leitura
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: log.isRead ? '#059669' : 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={14} />
                {log.isRead ? `Lido em ${new Date(log.readAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Não aberto no app ainda'}
              </div>
            </div>
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
                      {liveStats.platform_delivery_stats && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                          {liveStats.platform_delivery_stats.ios?.successful || 0} iOS • {liveStats.platform_delivery_stats.android?.successful || 0} Android
                        </div>
                      )}
                    </div>

                    <div style={{ padding: 10, borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Cliques / Aberturas</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa', marginTop: 2 }}>
                        {liveStats.converted ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                        Abertos direto pelo push
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
