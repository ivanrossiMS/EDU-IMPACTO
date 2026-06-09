'use client'

/**
 * PushDiagnosticoPanel.tsx
 * 
 * Painel administrativo de diagnóstico do sistema de Push Notifications.
 * 
 * Exibe:
 * - Status da configuração (App ID, REST Key, modo mock)
 * - Estatísticas gerais (enviados, falhas, ignorados)
 * - Logs recentes com filtros por tipo e status
 * - Botão "Enviar Push de Teste"
 * - Botão "Limpar logs antigos"
 * 
 * Acesso: apenas perfil Administrador
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, BellOff, BellRing, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Trash2, Send, ChevronDown, ChevronUp, Clock, Users,
  Settings, Shield, Zap, Activity, Info,
} from 'lucide-react'

interface PushLog {
  id: string
  type: string
  title: string
  status: 'sent' | 'failed' | 'skipped' | 'test'
  targetCount: number
  errorMessage: string | null
  createdAt: string
  targetUrl: string
}

interface DiagnosticoData {
  config: {
    hasAppId: boolean
    hasRestKey: boolean
    isMockMode: boolean
    appId: string | null
    appUrl: string
  }
  stats: {
    totalSent: number
    totalFailed: number
    totalSkipped: number
  }
  recentLogs: PushLog[]
}

const TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  comunicados: { label: 'Comunicado', emoji: '📢', color: '#4f46e5' },
  momentos: { label: 'Momento', emoji: '📸', color: '#ec4899' },
  calendario: { label: 'Calendário', emoji: '📅', color: '#10b981' },
  frequencia: { label: 'Frequência', emoji: '✋', color: '#f59e0b' },
  ocorrencias: { label: 'Ocorrência', emoji: '⚠️', color: '#ef4444' },
  notas: { label: 'Notas', emoji: '🏆', color: '#6366f1' },
  cobrancas: { label: 'Cobrança', emoji: '💰', color: '#14b8a6' },
  test: { label: 'Teste', emoji: '🔔', color: '#8b5cf6' },
}

export function PushDiagnosticoPanel() {
  const [data, setData] = useState<DiagnosticoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [testLoading, setTestLoading] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [testUserId, setTestUserId] = useState('')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/push/diagnostico')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        const err = await res.json()
        showMessage(err.error || 'Erro ao carregar diagnóstico', 'error')
      }
    } catch (e: any) {
      showMessage(`Erro de rede: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleTestPush = async () => {
    setTestLoading(true)
    try {
      const res = await fetch('/api/push/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-push', userId: testUserId || undefined }),
      })
      const result = await res.json()
      if (result.mock) {
        showMessage('⚠️ Push simulado (MOCK MODE — configure as credenciais do OneSignal)', 'info')
      } else if (result.ok) {
        showMessage('✅ Push de teste enviado com sucesso!', 'success')
      } else {
        showMessage(`❌ Falha: ${result.error || 'Erro desconhecido'}`, 'error')
      }
      load()
    } catch (e: any) {
      showMessage(`Erro: ${e.message}`, 'error')
    } finally {
      setTestLoading(false)
    }
  }

  const handleClearLogs = async () => {
    if (!confirm('Remover logs com mais de 30 dias?')) return
    setClearLoading(true)
    try {
      const res = await fetch('/api/push/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-logs' }),
      })
      const result = await res.json()
      showMessage(`🗑️ ${result.deleted || 0} logs antigos removidos`, 'success')
      load()
    } catch (e: any) {
      showMessage(`Erro: ${e.message}`, 'error')
    } finally {
      setClearLoading(false)
    }
  }

  const filteredLogs = (data?.recentLogs || []).filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false
    if (filterStatus !== 'all' && log.status !== filterStatus) return false
    return true
  })

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: '#4f46e5' }} />
        <span style={{ color: '#64748b', fontSize: 14 }}>Carregando diagnóstico...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!data) return null

  const { config, stats } = data
  const isHealthy = config.hasAppId && config.hasRestKey && !config.isMockMode

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Mensagem de feedback */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              background: message.type === 'success' ? '#f0fdf4' : message.type === 'error' ? '#fef2f2' : '#eff6ff',
              border: `1px solid ${message.type === 'success' ? '#bbf7d0' : message.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
              color: message.type === 'success' ? '#15803d' : message.type === 'error' ? '#dc2626' : '#1d4ed8',
              fontSize: 14, fontWeight: 600,
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Geral */}
      <div style={{
        background: isHealthy
          ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
          : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        border: `1px solid ${isHealthy ? '#bbf7d0' : '#fde68a'}`,
        borderRadius: 20,
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: isHealthy ? '#16a34a' : '#f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 20px ${isHealthy ? 'rgba(22,163,74,0.25)' : 'rgba(245,158,11,0.25)'}`,
          flexShrink: 0,
        }}>
          {isHealthy ? <Bell size={26} color="white" /> : <AlertTriangle size={26} color="white" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            {isHealthy ? '✅ Sistema de Push Operacional' : '⚠️ Modo Simulado (MOCK)'}
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
            {isHealthy
              ? `App ID configurado: ${config.appId} | URL: ${config.appUrl}`
              : 'Configure ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY nas variáveis de ambiente para ativar o envio real.'}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)',
            background: 'white', color: '#475569', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Atualizar
        </button>
      </div>

      {/* Credenciais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { label: 'App ID', ok: config.hasAppId, detail: config.hasAppId ? config.appId : 'Não configurado' },
          { label: 'REST API Key', ok: config.hasRestKey, detail: config.hasRestKey ? '••••••••••••' : 'Não configurada' },
          { label: 'Modo de Envio', ok: !config.isMockMode, detail: config.isMockMode ? 'Simulado (MOCK)' : 'Real (OneSignal)' },
          { label: 'URL do App', ok: config.appUrl !== 'N/A', detail: config.appUrl },
        ].map(item => (
          <div key={item.label} style={{
            padding: '16px 20px', borderRadius: 16,
            background: item.ok ? 'rgba(240,253,244,0.8)' : 'rgba(254,242,242,0.8)',
            border: `1px solid ${item.ok ? '#bbf7d0' : '#fecaca'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{item.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {item.ok
                ? <CheckCircle2 size={16} color="#16a34a" />
                : <XCircle size={16} color="#ef4444" />
              }
              <span style={{ fontSize: 13, fontWeight: 600, color: item.ok ? '#15803d' : '#dc2626', wordBreak: 'break-all' }}>
                {item.detail}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Enviados', value: stats.totalSent, icon: <CheckCircle2 size={22} />, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Falhas', value: stats.totalFailed, icon: <XCircle size={22} />, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
          { label: 'Ignorados', value: stats.totalSkipped, icon: <Info size={22} />, color: '#6366f1', bg: '#f5f3ff', border: '#ddd6fe' },
        ].map(stat => (
          <div key={stat.label} style={{ padding: '20px 24px', borderRadius: 20, background: stat.bg, border: `1px solid ${stat.border}`, textAlign: 'center' }}>
            <div style={{ color: stat.color, display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: stat.color, opacity: 0.7, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Enviar Push de Teste */}
      <div style={{ padding: '20px 24px', borderRadius: 20, background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="white" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Enviar Push de Teste</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="ID do usuário (deixe vazio para usar o seu)"
            value={testUserId}
            onChange={e => setTestUserId(e.target.value)}
            style={{
              flex: 1, minWidth: 200, padding: '10px 16px', borderRadius: 12,
              border: '1px solid #e2e8f0', fontSize: 14, outline: 'none',
              background: '#f8fafc', color: '#0f172a',
            }}
          />
          <button
            onClick={handleTestPush}
            disabled={testLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white', fontSize: 14, fontWeight: 700,
              cursor: testLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(79,70,229,0.3)', opacity: testLoading ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {testLoading
              ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={15} />
            }
            {testLoading ? 'Enviando...' : 'Enviar teste'}
          </button>
          <button
            onClick={handleClearLogs}
            disabled={clearLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              borderRadius: 12, border: '1px solid #fecaca',
              background: '#fef2f2', color: '#dc2626', fontSize: 14, fontWeight: 600,
              cursor: clearLoading ? 'not-allowed' : 'pointer', opacity: clearLoading ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {clearLoading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />}
            Limpar logs antigos
          </button>
        </div>
      </div>

      {/* Logs Recentes */}
      <div style={{ padding: '20px 24px', borderRadius: 20, background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="white" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Logs Recentes
              <span style={{ marginLeft: 8, fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                ({filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''})
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
            >
              <option value="all">Todos os tipos</option>
              {Object.entries(TYPE_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.emoji} {val.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
            >
              <option value="all">Todos os status</option>
              <option value="sent">Enviados</option>
              <option value="failed">Falhas</option>
              <option value="skipped">Ignorados</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <BellOff size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhum log encontrado</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLogs.map(log => {
              const typeInfo = TYPE_LABELS[log.type] || { label: log.type, emoji: '🔔', color: '#64748b' }
              const isExpanded = expandedLog === log.id
              const isSuccess = log.status === 'sent'
              const isFailed = log.status === 'failed'

              return (
                <div key={log.id} style={{
                  border: `1px solid ${isFailed ? '#fecaca' : '#e2e8f0'}`,
                  borderRadius: 14, overflow: 'hidden',
                  background: isFailed ? '#fef2f2' : '#fafafa',
                }}>
                  <div
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{typeInfo.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.title}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{formatTime(log.createdAt)}</span>
                        <span>·</span>
                        <span style={{ color: typeInfo.color }}>{typeInfo.label}</span>
                        {log.targetCount > 0 && <>
                          <span>·</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Users size={10} /> {log.targetCount} destinatário{log.targetCount !== 1 ? 's' : ''}
                          </span>
                        </>}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 20,
                      background: isSuccess ? '#f0fdf4' : isFailed ? '#fef2f2' : '#f5f3ff',
                      border: `1px solid ${isSuccess ? '#bbf7d0' : isFailed ? '#fecaca' : '#ddd6fe'}`,
                      fontSize: 11, fontWeight: 700,
                      color: isSuccess ? '#16a34a' : isFailed ? '#dc2626' : '#7c3aed',
                      flexShrink: 0,
                    }}>
                      {isSuccess ? <CheckCircle2 size={11} /> : isFailed ? <XCircle size={11} /> : <Clock size={11} />}
                      {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falhou' : 'Ignorado'}
                    </div>
                    {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ borderTop: '1px solid #e2e8f0', padding: '12px 16px', fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 6, background: 'white' }}>
                          <div><strong>URL:</strong> {log.targetUrl || '—'}</div>
                          <div><strong>Item ID:</strong> {log.id}</div>
                          {log.errorMessage && (
                            <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: 8, color: '#dc2626', fontFamily: 'monospace' }}>
                              <strong>Erro:</strong> {log.errorMessage}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
