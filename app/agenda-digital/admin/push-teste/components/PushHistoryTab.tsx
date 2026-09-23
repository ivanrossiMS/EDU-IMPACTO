'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Clock, Search, Filter, RefreshCw, Smartphone, Eye,
  CheckCircle2, AlertTriangle, ArrowRight, User, Users,
  GraduationCap, Briefcase, ChevronLeft, ChevronRight,
  ExternalLink, X, Send, Radio, Sparkles, Check, Info,
  Laptop, Calendar, Camera, FileText, DollarSign, Car, Bell
} from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import { PushUserSearchModal, SelectedHistoryUser } from './PushUserSearchModal'
import { PushHistoryDetailModal } from './PushHistoryDetailModal'
import { toast } from 'sonner'

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  frequencia: { label: 'Frequência Escolar', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: CheckCircle2 },
  saida: { label: 'Portaria & Saída', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)', icon: Car },
  comunicados: { label: 'Comunicados', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', icon: Bell },
  momentos: { label: 'Momentos & Mídia', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', icon: Camera },
  calendario: { label: 'Calendário & Eventos', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', icon: Calendar },
  notas: { label: 'Boletim & Notas', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', icon: FileText },
  ocorrencias: { label: 'Ocorrências', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: AlertTriangle },
  cobrancas: { label: 'Cobranças & Fin.', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', icon: DollarSign },
  test: { label: 'Teste / Diagnóstico', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: Radio },
}

interface PushHistoryTabProps {
  onSwitchToTesterWithPayload?: (payload: { title: string; message: string; category?: string; targetRoute?: string }) => void
}

export function PushHistoryTab({ onSwitchToTesterWithPayload }: PushHistoryTabProps) {
  // Filtros principais
  const [selectedUser, setSelectedUser] = useState<SelectedHistoryUser | null>(null)
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('7d')

  // Paginação e dados
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [logs, setLogs] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Dispositivos do usuário selecionado
  const [userDevices, setUserDevices] = useState<any[]>([])

  // Modal de Detalhes
  const [detailLog, setDetailLog] = useState<any | null>(null)

  // Carregar histórico da API
  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('history', 'true')
      params.append('page', String(page))
      params.append('limit', String(limit))

      if (selectedDateRange && selectedDateRange !== 'all') {
        params.append('date_range', selectedDateRange)
      }
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory)
      }
      if (selectedStatus && selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }
      if (selectedUser) {
        params.append('user_id', selectedUser.id)
        params.append('user_type', selectedUser.tipo)
      }

      const res = await fetch(`/api/agenda/push/test?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotalCount(data.total || 0)
        setTotalPages(data.totalPages || 1)
        if (data.userDevices) {
          setUserDevices(data.userDevices || [])
        } else if (!selectedUser) {
          setUserDevices([])
        }
      }
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
      toast.error('Erro ao conectar com o servidor para buscar histórico.')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, selectedDateRange, selectedCategory, selectedStatus, searchQuery, selectedUser])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Resetar página ao mudar filtros
  const handleFilterChange = (setter: (v: any) => void, val: any) => {
    setter(val)
    setPage(1)
  }

  // Estatísticas calculadas da página atual
  const successfulCount = logs.filter(l => l.status === 'sent').length
  const readCount = logs.filter(l => l.isRead).length
  const successRate = logs.length > 0 ? Math.round((successfulCount / logs.length) * 100) : 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── SEÇÃO SUPERIOR: CARDS KPI / RESUMO DE ENTREGA ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
              Disparos Registrados
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={16} color="#6366f1" />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', marginTop: 8 }}>
            {totalCount.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
            {selectedUser ? `Histórico específico de ${selectedUser.nome.split(' ')[0]}` : 'Notificações enviadas pela escola'}
          </div>
        </div>

        <div style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
              Taxa de Sucesso no Gateway
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#10b981', marginTop: 8 }}>
            {successRate}%
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
            {successfulCount} entregues de {logs.length} na página atual
          </div>
        </div>

        <div style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
              Aparelhos Conectados
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(14, 165, 233, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={16} color="#0ea5e9" />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#0ea5e9', marginTop: 8 }}>
            {selectedUser ? userDevices.length : '100%'}
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
            {selectedUser
              ? `${userDevices.filter(d => d.isSubscribed).length} com push ativo nos ajustes`
              : 'Monitoramento contínuo OneSignal'}
          </div>
        </div>

        <div style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
              Aberturas Confirmadas
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(236, 72, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={16} color="#ec4899" />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#ec4899', marginTop: 8 }}>
            {readCount}
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
            Leituras registradas no Notification Center
          </div>
        </div>
      </div>

      {/* ── CARD DE SELEÇÃO DE USUÁRIO (AUDITORIA INDIVIDUAL OU GLOBAL) ── */}
      <div style={{
        background: 'hsl(var(--bg-surface))',
        border: '1.5px solid hsl(var(--border-subtle))',
        borderRadius: 18,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} color="#6366f1" />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
                Escopo de Usuário para Auditoria
              </h3>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Selecione um aluno, pai/mãe ou colaborador para auditar os pushes enviados a ele e os aparelhos receptores.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setIsUserSearchOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                background: '#6366f1',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Search size={14} />
              {selectedUser ? 'Trocar Usuário' : 'Selecionar Usuário Específico'}
            </button>

            {selectedUser && (
              <button
                onClick={() => {
                  setSelectedUser(null)
                  setUserDevices([])
                  setPage(1)
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12 }}
                title="Limpar seleção e voltar à visão geral da escola"
              >
                Ver Todos os Usuários
              </button>
            )}
          </div>
        </div>

        {/* Informações do Usuário Selecionado */}
        {selectedUser ? (
          <div style={{
            background: 'hsl(var(--bg-main))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <UserAvatar name={selectedUser.nome} fotoUrl={selectedUser.foto || undefined} size={46} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{selectedUser.nome}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#6366f1',
                      textTransform: 'uppercase',
                    }}>
                      {selectedUser.tipo}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                    {selectedUser.subtitulo || `ID: ${selectedUser.id}`}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: userDevices.length > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: userDevices.length > 0 ? '#059669' : '#dc2626',
                  fontWeight: 700,
                  fontSize: 12,
                }}>
                  {userDevices.length} aparelho(s) registrado(s) no OneSignal
                </span>
              </div>
            </div>

            {/* Lista dos Aparelhos do Usuário (se houver) */}
            {userDevices.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 8,
                marginTop: 4,
                paddingTop: 10,
                borderTop: '1px solid hsl(var(--border-subtle))'
              }}>
                {userDevices.map((dev: any, i: number) => {
                  const isDevActive = dev.isSubscribed
                  return (
                    <div
                      key={dev.id || i}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-subtle))',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {dev.tipo === 'iOS' ? <Smartphone size={14} color="#6366f1" /> : dev.tipo === 'Android' ? <Smartphone size={14} color="#10b981" /> : <Laptop size={14} color="#0ea5e9" />}
                        <div>
                          <div style={{ fontWeight: 700 }}>{dev.modelo || dev.tipo}</div>
                          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{dev.sistema || dev.tipo}</div>
                        </div>
                      </div>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isDevActive ? '#10b981' : '#ef4444',
                      }} title={isDevActive ? 'Push Conectado' : 'Push Inativo ou Bloqueado'} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontStyle: 'italic', paddingTop: 4 }}>
                Nenhum aparelho com token ativo associado a este usuário no momento.
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: 'hsl(var(--bg-main))',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 12,
            color: 'hsl(var(--text-muted))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
              <b>Modo Global:</b> Exibindo todos os disparos registrados na escola (frequência, comunicados, portaria, etc.).
            </div>
            <span style={{ fontSize: 11 }}>Página {page} de {totalPages}</span>
          </div>
        )}
      </div>

      {/* ── BARRA DE FILTROS E PESQUISA ── */}
      <div style={{
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 16,
        padding: '14px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search size={15} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
              placeholder="Buscar no título ou texto..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 10,
                border: '1px solid hsl(var(--border-subtle))',
                background: 'hsl(var(--bg-main))',
                color: 'hsl(var(--text-main))',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          {/* Filtro de Categoria */}
          <select
            value={selectedCategory}
            onChange={e => handleFilterChange(setSelectedCategory, e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))',
              color: 'hsl(var(--text-main))',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Todas as Categorias</option>
            <option value="saida">🚗 Portaria & Saída</option>
            <option value="frequencia">✅ Frequência Escolar</option>
            <option value="comunicados">📢 Comunicados Oficiais</option>
            <option value="momentos">📸 Momentos & Mídia</option>
            <option value="calendario">📅 Eventos & Calendário</option>
            <option value="notas">🏆 Boletim & Notas</option>
            <option value="ocorrencias">⚠️ Ocorrências</option>
            <option value="cobrancas">💰 Cobranças & Financeiro</option>
            <option value="test">🔔 Diagnóstico / Testes</option>
          </select>

          {/* Filtro de Status */}
          <select
            value={selectedStatus}
            onChange={e => handleFilterChange(setSelectedStatus, e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))',
              color: 'hsl(var(--text-main))',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Todos os Status</option>
            <option value="sent">🟢 Enviados com Sucesso</option>
            <option value="failed">🔴 Falhas / Rejeitados</option>
          </select>
        </div>

        {/* Filtros de Período e Botão de Atualização */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-main))', borderRadius: 10, padding: 3, border: '1px solid hsl(var(--border-subtle))' }}>
            {[
              { id: 'today', label: 'Hoje' },
              { id: '7d', label: '7 Dias' },
              { id: '30d', label: '30 Dias' },
              { id: 'all', label: 'Todos' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(setSelectedDateRange, tab.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: selectedDateRange === tab.id ? '#6366f1' : 'transparent',
                  color: selectedDateRange === tab.id ? 'white' : 'hsl(var(--text-muted))',
                  fontSize: 11,
                  fontWeight: selectedDateRange === tab.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadHistory()}
            disabled={isLoading}
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: 10, padding: 8 }}
            title="Atualizar lista"
          >
            <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>
      </div>

      {/* ── FEED / TABELA DE HISTÓRICO DE DISPAROS ── */}
      <div style={{
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.03)',
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <RefreshCw size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
            Carregando histórico de disparos...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
            <Clock size={36} color="hsl(var(--border-subtle))" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-main))' }}>
              Nenhum disparo encontrado
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Tente ajustar os filtros de data, categoria ou limpar a busca.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header da Lista */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr 140px 160px 120px',
              padding: '12px 20px',
              background: 'hsl(var(--bg-main))',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              fontSize: 11,
              fontWeight: 800,
              color: 'hsl(var(--text-muted))',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              <div>Categoria & Tipo</div>
              <div>Conteúdo da Notificação</div>
              <div>Destinatários</div>
              <div>Status & Entrega</div>
              <div style={{ textAlign: 'right' }}>Ação</div>
            </div>

            {/* Linhas da Lista */}
            {logs.map((log: any, index: number) => {
              const catDef = CATEGORY_MAP[log.type] || CATEGORY_MAP.test
              const Icon = catDef.icon
              const isSuccess = log.status === 'sent'
              const formattedDate = new Date(log.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={log.id || index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr 140px 160px 120px',
                    padding: '14px 20px',
                    borderBottom: '1px solid hsl(var(--border-subtle))',
                    alignItems: 'center',
                    fontSize: 12,
                    background: index % 2 === 0 ? 'transparent' : 'hsl(var(--bg-main) / 0.4)',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Coluna 1: Categoria & Data */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: catDef.bg,
                        color: catDef.color,
                      }}>
                        <Icon size={11} />
                        {catDef.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      {formattedDate}
                    </div>
                  </div>

                  {/* Coluna 2: Título e Mensagem */}
                  <div style={{ paddingRight: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {log.title}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'hsl(var(--text-muted))',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 480,
                    }}>
                      {log.message}
                    </div>
                  </div>

                  {/* Coluna 3: Destinatários */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: 'hsl(var(--text-main))', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Users size={13} color="#6366f1" />
                      <span>{log.recipient_summary || `${log.target_count || 1} usuário(s)`}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {log.target_count || 1} alvos • {log.item_id?.split('_')[0] || 'Evento'}
                    </div>
                  </div>

                  {/* Coluna 4: Status & Confirmação de Leitura */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: isSuccess ? '#10b981' : '#ef4444',
                      }} />
                      <span style={{ fontWeight: 700, color: isSuccess ? '#059669' : '#dc2626' }}>
                        {isSuccess ? 'Entregue' : 'Falha'}
                      </span>
                    </div>

                    {log.isRead ? (
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                        <Eye size={11} /> Lido no app
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
                        Aguardando leitura
                      </div>
                    )}
                  </div>

                  {/* Coluna 5: Ação */}
                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => setDetailLog(log)}
                      style={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        color: '#6366f1',
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid hsl(var(--border-subtle))',
            background: 'hsl(var(--bg-main))',
            fontSize: 12,
          }}>
            <div style={{ color: 'hsl(var(--text-muted))' }}>
              Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, totalCount)} de {totalCount.toLocaleString('pt-BR')} registros
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-ghost btn-sm"
                style={{ borderRadius: 8, padding: '4px 10px', fontSize: 11 }}
              >
                <ChevronLeft size={14} /> Anterior
              </button>

              <span style={{ fontWeight: 700, padding: '0 8px' }}>
                {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn btn-ghost btn-sm"
                style={{ borderRadius: 8, padding: '4px 10px', fontSize: 11 }}
              >
                Próxima <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAIS ── */}
      <PushUserSearchModal
        isOpen={isUserSearchOpen}
        onClose={() => setIsUserSearchOpen(false)}
        onSelectUser={user => {
          setSelectedUser(user)
          setPage(1)
        }}
        currentUserSelected={selectedUser}
      />

      <PushHistoryDetailModal
        log={detailLog}
        onClose={() => setDetailLog(null)}
        onResend={log => {
          setDetailLog(null)
          if (onSwitchToTesterWithPayload) {
            onSwitchToTesterWithPayload({
              title: log.title || '',
              message: log.message || '',
              category: log.type || 'test',
              targetRoute: log.target_url?.replace(/^https?:\/\/[^/]+\/agenda-digital/, '') || '',
            })
            toast.info('Dados carregados no simulador para reenvio!')
          }
        }}
      />
    </div>
  )
}
