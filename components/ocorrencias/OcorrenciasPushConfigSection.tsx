'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertTriangle,
  X,
  Save,
  Filter,
  UserCheck,
  Laptop,
  Info,
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { notificationService } from '@/lib/notifications/notificationService'

export interface ColaboradorItem {
  id: string
  auth_id?: string | null
  nome: string
  email: string
  cargo: string
  perfil: string
  status: string
  foto?: string | null
}

export interface OcorrenciasPushConfigState {
  enabled: boolean
  notifyOnNewOcorrencia: boolean
  notifyOnCienciaConfirmada: boolean
  notifyRealtimeSound: boolean
  selectedUserIds: string[]
  configured?: boolean
  updatedAt?: string
}

export interface DeviceStatusInfo {
  activeCount: number
  iosCount: number
  androidCount: number
  webCount: number
  hasActiveDevice: boolean
}

type CategoryFilter =
  | 'todos'
  | 'selecionados'
  | 'com_aparelho'
  | 'coordenacao'
  | 'direcao'
  | 'professores'
  | 'secretaria'
  | 'portaria'

function classifyColabCategory(c: ColaboradorItem): CategoryFilter[] {
  const cargo = (c.cargo || '').toLowerCase()
  const perfil = (c.perfil || '').toLowerCase()
  const combined = `${cargo} ${perfil}`
  const cats: CategoryFilter[] = ['todos']

  if (combined.includes('coord') || combined.includes('orienta') || combined.includes('pedag')) {
    cats.push('coordenacao')
  }
  if (
    combined.includes('diret') ||
    combined.includes('admin') ||
    combined.includes('master') ||
    combined.includes('gestor') ||
    combined.includes('mantenedor')
  ) {
    cats.push('direcao')
  }
  if (combined.includes('prof') || combined.includes('docente') || combined.includes('auxiliar de sala')) {
    cats.push('professores')
  }
  if (
    combined.includes('secret') ||
    combined.includes('atend') ||
    combined.includes('recep') ||
    combined.includes('financ') ||
    combined.includes('administrativo')
  ) {
    cats.push('secretaria')
  }
  if (
    combined.includes('portar') ||
    combined.includes('inspet') ||
    combined.includes('seguran') ||
    combined.includes('monitor') ||
    combined.includes('apoio')
  ) {
    cats.push('portaria')
  }
  return cats
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function OcorrenciasPushConfigSection() {
  const { currentUser } = useApp()

  const [colaboradores, setColaboradores] = useState<ColaboradorItem[]>([])
  const [loadingColabs, setLoadingColabs] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [refreshingDevices, setRefreshingDevices] = useState(false)

  const [config, setConfig] = useState<OcorrenciasPushConfigState>({
    enabled: true,
    notifyOnNewOcorrencia: true,
    notifyOnCienciaConfirmada: true,
    notifyRealtimeSound: true,
    selectedUserIds: [],
  })
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState<string>('')

  const [deviceStatusMap, setDeviceStatusMap] = useState<Record<string, DeviceStatusInfo>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('todos')

  const [saving, setSaving] = useState(false)
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error'
    title: string
    message: string
    details?: string[]
  } | null>(null)

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [requestingPermission, setRequestingPermission] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission)
    } else {
      setBrowserPermission('unsupported')
    }
  }, [])

  const fetchDeviceStatuses = useCallback(async (userIdsToCheck: string[], silent = false) => {
    if (!silent) setRefreshingDevices(true)
    try {
      const query = userIdsToCheck.length > 0 ? `?userIds=${encodeURIComponent(userIdsToCheck.join(','))}` : ''
      const res = await fetch(`/api/ocorrencias/notificar-colaboradores${query}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.status) {
          setDeviceStatusMap(prev => ({ ...prev, ...data.status }))
        }
        return data
      }
    } catch (err) {
      console.warn('[OcorrenciasPushConfig] Aviso ao consultar status de aparelhos:', err)
    } finally {
      if (!silent) setRefreshingDevices(false)
    }
    return null
  }, [])

  useEffect(() => {
    let active = true

    const loadAll = async () => {
      setLoadingColabs(true)
      setLoadingConfig(true)
      try {
        const [colabsRes, cfgRes] = await Promise.all([
          fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000', { cache: 'no-store' }),
          fetch('/api/ocorrencias/notificar-colaboradores', { cache: 'no-store' }),
        ])

        let loadedColabs: ColaboradorItem[] = []
        if (colabsRes.ok) {
          const colabsJson = await colabsRes.json()
          const rawList = Array.isArray(colabsJson?.data) ? colabsJson.data : []
          loadedColabs = rawList
            .filter((u: any) => !u.status || String(u.status).toLowerCase() === 'ativo')
            .map((u: any) => ({
              id: String(u.id),
              auth_id: u.auth_id || null,
              nome: String(u.nome || u.email || 'Colaborador').trim(),
              email: String(u.email || '').trim(),
              cargo: String(u.cargo || u.perfil || 'Colaborador').trim(),
              perfil: String(u.perfil || 'Colaborador').trim(),
              status: String(u.status || 'Ativo'),
              foto: u.foto || null,
            }))
            .sort((a: ColaboradorItem, b: ColaboradorItem) => a.nome.localeCompare(b.nome, 'pt-BR'))

          if (active) setColaboradores(loadedColabs)
        }

        if (cfgRes.ok) {
          const cfgJson = await cfgRes.json()
          if (cfgJson?.config && active) {
            const c = cfgJson.config
            // Normaliza os IDs selecionados cruzando id e auth_id para evitar divergência
            const rawIds: string[] = Array.isArray(c.selectedUserIds) ? c.selectedUserIds.map(String) : []
            const normalizedIds: string[] = []
            for (const rawId of rawIds) {
              const matched = loadedColabs.find(col => col.id === rawId || (col.auth_id && col.auth_id === rawId))
              const finalId = matched ? matched.id : rawId
              if (!normalizedIds.includes(finalId)) normalizedIds.push(finalId)
            }

            const nextCfg: OcorrenciasPushConfigState = {
              enabled: c.enabled !== false,
              notifyOnNewOcorrencia: c.notifyOnNewOcorrencia !== false,
              notifyOnCienciaConfirmada: c.notifyOnCienciaConfirmada !== false,
              notifyRealtimeSound: c.notifyRealtimeSound !== false,
              selectedUserIds: normalizedIds,
              configured: Boolean(c.configured),
              updatedAt: c.updatedAt,
            }
            setConfig(nextCfg)
            setSavedConfigSnapshot(
              JSON.stringify({
                enabled: nextCfg.enabled,
                notifyOnNewOcorrencia: nextCfg.notifyOnNewOcorrencia,
                notifyOnCienciaConfirmada: nextCfg.notifyOnCienciaConfirmada,
                notifyRealtimeSound: nextCfg.notifyRealtimeSound,
                selectedUserIds: [...nextCfg.selectedUserIds].sort(),
              })
            )
          }
          if (cfgJson?.status && active) {
            setDeviceStatusMap(cfgJson.status)
          }
        }

        // Busca em background o status OneSignal de todos os colaboradores carregados
        if (loadedColabs.length > 0 && active) {
          const allIds = loadedColabs.map(c => c.id)
          fetchDeviceStatuses(allIds, true)
        }
      } catch (err) {
        console.error('[OcorrenciasPushConfig] Erro ao carregar configurações:', err)
      } finally {
        if (active) {
          setLoadingColabs(false)
          setLoadingConfig(false)
        }
      }
    }

    loadAll()
    return () => {
      active = false
    }
  }, [fetchDeviceStatuses])

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      enabled: config.enabled,
      notifyOnNewOcorrencia: config.notifyOnNewOcorrencia,
      notifyOnCienciaConfirmada: config.notifyOnCienciaConfirmada,
      notifyRealtimeSound: config.notifyRealtimeSound,
      selectedUserIds: [...config.selectedUserIds].sort(),
    })
  }, [config])

  const hasChanges = useMemo(() => {
    if (!savedConfigSnapshot) return false
    return currentSnapshot !== savedConfigSnapshot
  }, [currentSnapshot, savedConfigSnapshot])

  const getColabDeviceStatus = useCallback(
    (colab: ColaboradorItem): DeviceStatusInfo => {
      const byId = deviceStatusMap[colab.id]
      if (byId) return byId
      if (colab.auth_id && deviceStatusMap[colab.auth_id]) {
        return deviceStatusMap[colab.auth_id]
      }
      return {
        activeCount: 0,
        iosCount: 0,
        androidCount: 0,
        webCount: 0,
        hasActiveDevice: false,
      }
    },
    [deviceStatusMap]
  )

  const isColabSelected = useCallback(
    (colab: ColaboradorItem): boolean => {
      return (
        config.selectedUserIds.includes(colab.id) ||
        Boolean(colab.auth_id && config.selectedUserIds.includes(colab.auth_id))
      )
    },
    [config.selectedUserIds]
  )

  const toggleCollaborator = (colab: ColaboradorItem) => {
    setConfig(prev => {
      const currentlySelected =
        prev.selectedUserIds.includes(colab.id) ||
        Boolean(colab.auth_id && prev.selectedUserIds.includes(colab.auth_id))

      let nextIds: string[]
      if (currentlySelected) {
        nextIds = prev.selectedUserIds.filter(id => id !== colab.id && id !== colab.auth_id)
      } else {
        nextIds = Array.from(new Set([...prev.selectedUserIds, colab.id]))
      }
      return {
        ...prev,
        selectedUserIds: nextIds,
      }
    })
  }

  const filteredColaboradores = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return colaboradores.filter(c => {
      if (q) {
        const matchText =
          c.nome.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.cargo.toLowerCase().includes(q) ||
          c.perfil.toLowerCase().includes(q)
        if (!matchText) return false
      }

      if (categoryFilter === 'todos') return true
      if (categoryFilter === 'selecionados') return isColabSelected(c)
      if (categoryFilter === 'com_aparelho') return getColabDeviceStatus(c).hasActiveDevice

      const cats = classifyColabCategory(c)
      return cats.includes(categoryFilter)
    })
  }, [colaboradores, searchTerm, categoryFilter, isColabSelected, getColabDeviceStatus])

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      todos: colaboradores.length,
      selecionados: 0,
      com_aparelho: 0,
      coordenacao: 0,
      direcao: 0,
      professores: 0,
      secretaria: 0,
      portaria: 0,
    }
    for (const c of colaboradores) {
      if (isColabSelected(c)) counts.selecionados++
      if (getColabDeviceStatus(c).hasActiveDevice) counts.com_aparelho++
      const cats = classifyColabCategory(c)
      for (const cat of cats) {
        if (cat !== 'todos') counts[cat]++
      }
    }
    return counts
  }, [colaboradores, isColabSelected, getColabDeviceStatus])

  const selectedWithActiveDeviceCount = useMemo(() => {
    return colaboradores.filter(c => isColabSelected(c) && getColabDeviceStatus(c).hasActiveDevice).length
  }, [colaboradores, isColabSelected, getColabDeviceStatus])

  const selectAllVisible = () => {
    const visibleIds = filteredColaboradores.map(c => c.id)
    setConfig(prev => ({
      ...prev,
      selectedUserIds: Array.from(new Set([...prev.selectedUserIds, ...visibleIds])),
    }))
  }

  const selectAllWithActiveDevice = () => {
    const activeIds = colaboradores.filter(c => getColabDeviceStatus(c).hasActiveDevice).map(c => c.id)
    setConfig(prev => ({
      ...prev,
      selectedUserIds: Array.from(new Set([...prev.selectedUserIds, ...activeIds])),
    }))
  }

  const clearVisibleSelection = () => {
    const visibleSet = new Set<string>()
    for (const c of filteredColaboradores) {
      visibleSet.add(c.id)
      if (c.auth_id) visibleSet.add(c.auth_id)
    }
    setConfig(prev => ({
      ...prev,
      selectedUserIds: prev.selectedUserIds.filter(id => !visibleSet.has(id)),
    }))
  }

  const discardChanges = () => {
    if (!savedConfigSnapshot) return
    try {
      const parsed = JSON.parse(savedConfigSnapshot)
      setConfig(prev => ({
        ...prev,
        enabled: parsed.enabled !== false,
        notifyOnNewOcorrencia: parsed.notifyOnNewOcorrencia !== false,
        notifyOnCienciaConfirmada: parsed.notifyOnCienciaConfirmada !== false,
        notifyRealtimeSound: parsed.notifyRealtimeSound !== false,
        selectedUserIds: Array.isArray(parsed.selectedUserIds) ? parsed.selectedUserIds : [],
      }))
      setFeedbackBanner(null)
    } catch {}
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaving(true)
    setFeedbackBanner(null)
    try {
      const res = await fetch('/api/ocorrencias/notificar-colaboradores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            enabled: config.enabled,
            notifyOnNewOcorrencia: config.notifyOnNewOcorrencia,
            notifyOnCienciaConfirmada: config.notifyOnCienciaConfirmada,
            notifyRealtimeSound: config.notifyRealtimeSound,
            selectedUserIds: config.selectedUserIds,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível salvar as configurações.')
      }

      const saved = data.config
      setConfig(prev => ({
        ...prev,
        configured: true,
        updatedAt: saved?.updatedAt || new Date().toISOString(),
      }))
      setSavedConfigSnapshot(
        JSON.stringify({
          enabled: config.enabled,
          notifyOnNewOcorrencia: config.notifyOnNewOcorrencia,
          notifyOnCienciaConfirmada: config.notifyOnCienciaConfirmada,
          notifyRealtimeSound: config.notifyRealtimeSound,
          selectedUserIds: [...config.selectedUserIds].sort(),
        })
      )
      setShowSaveSuccessModal(true)
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        title: 'Erro ao salvar configurações',
        message: err?.message || 'Verifique sua conexão e tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestNotification = async () => {
    if (config.selectedUserIds.length === 0) {
      setFeedbackBanner({
        type: 'warning',
        title: 'Nenhum colaborador selecionado',
        message: 'Selecione ao menos 1 colaborador na lista abaixo para enviar uma notificação push de teste.',
      })
      return
    }

    setTestingPush(true)
    setFeedbackBanner(null)
    try {
      const res = await fetch('/api/ocorrencias/notificar-colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          userIds: config.selectedUserIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao disparar teste de notificação.')
      }

      const details: string[] = []
      if (Array.isArray(data.colaboradoresAlcancados) && data.colaboradoresAlcancados.length > 0) {
        details.push(`Destinatários: ${data.colaboradoresAlcancados.join(', ')}`)
      }
      if (typeof data.activeSubscriptions === 'number') {
        details.push(
          `Aparelhos OneSignal ativos alcançados: ${data.activeSubscriptions} (além do alerta instantâneo em tela para quem está com o sistema aberto)`
        )
      }

      setFeedbackBanner({
        type: data.activeSubscriptions > 0 ? 'success' : 'warning',
        title:
          data.activeSubscriptions > 0
            ? 'Notificação de teste enviada com sucesso!'
            : 'Alerta em tela enviado (nenhum aparelho móvel/web com push ativo encontrado)',
        message:
          data.activeSubscriptions > 0
            ? 'Os colaboradores selecionados receberam o Push Notification em seus aparelhos e o banner sonoro em tempo real.'
            : 'O alerta em tempo real foi disparado na tela, mas os colaboradores selecionados ainda não ativaram o Push neste navegador ou no aplicativo móvel.',
        details,
      })
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        title: 'Erro ao testar notificação',
        message: err?.message || 'Não foi possível concluir o disparo de teste.',
      })
    } finally {
      setTestingPush(false)
    }
  }

  const handleRequestBrowserPermission = async () => {
    setRequestingPermission(true)
    try {
      await notificationService.requestNotificationPermission()
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setBrowserPermission(Notification.permission)
      }
      if (currentUser?.id) {
        await notificationService.syncUser(currentUser)
        setTimeout(() => {
          fetchDeviceStatuses(colaboradores.map(c => c.id), true)
        }, 1500)
      }
    } catch (err) {
      console.warn('[OcorrenciasPushConfig] Erro ao solicitar permissão:', err)
    } finally {
      setRequestingPermission(false)
    }
  }

  const filterChips: { id: CategoryFilter; label: string; count: number }[] = [
    { id: 'todos', label: 'Todos', count: categoryCounts.todos },
    { id: 'selecionados', label: 'Selecionados', count: categoryCounts.selecionados },
    { id: 'com_aparelho', label: 'Com Aparelho Ativo', count: categoryCounts.com_aparelho },
    { id: 'coordenacao', label: 'Coordenação / Pedagógico', count: categoryCounts.coordenacao },
    { id: 'direcao', label: 'Direção / Admin', count: categoryCounts.direcao },
    { id: 'professores', label: 'Professores', count: categoryCounts.professores },
    { id: 'secretaria', label: 'Secretaria / Adm.', count: categoryCounts.secretaria },
    { id: 'portaria', label: 'Portaria / Inspetoria', count: categoryCounts.portaria },
  ]

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: hasChanges ? 90 : 24 }}>
      {/* CARD PRINCIPAL DE CABEÇALHO E AÇÕES */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: 22,
          border: '1px solid #e2e8f0',
          padding: '24px 28px',
          boxShadow: '0 10px 30px -10px rgba(15, 23, 42, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', maxWidth: 720 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: config.enabled
                  ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
                  : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: config.enabled
                  ? '0 8px 20px -4px rgba(37, 99, 235, 0.35)'
                  : '0 4px 12px rgba(100, 116, 139, 0.2)',
              }}
            >
              <BellRing size={25} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#0f172a',
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Destinatários de Notificações Push — Ocorrências
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 11px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    background: config.enabled ? '#dcfce7' : '#fee2e2',
                    color: config.enabled ? '#15803d' : '#b91c1c',
                    border: `1px solid ${config.enabled ? '#86efac' : '#fca5a5'}`,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: config.enabled ? '#16a34a' : '#dc2626',
                    }}
                  />
                  {config.enabled ? 'SISTEMA ATIVO' : 'PAUSADO'}
                </span>
              </div>

              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#475569', lineHeight: 1.55 }}>
                Selecione quais colaboradores (Coordenação, Direção, Orientação Pedagógica, Professores ou Secretaria)
                deverão receber alertas Push instantâneos no celular (iOS/Android) e no computador sempre que uma
                ocorrência for registrada ou quando a família confirmar ciência.
              </p>

              {/* Resumo de métricas rápidas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <UserCheck size={14} />
                  <span>{categoryCounts.selecionados} colaborador(es) marcado(s)</span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 10,
                    background: selectedWithActiveDeviceCount > 0 ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${selectedWithActiveDeviceCount > 0 ? '#bbf7d0' : '#fde68a'}`,
                    color: selectedWithActiveDeviceCount > 0 ? '#15803d' : '#b45309',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Smartphone size={14} />
                  <span>{selectedWithActiveDeviceCount} selecionado(s) c/ aparelho ativo</span>
                </div>

                {config.updatedAt && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#64748b',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      Salvo em{' '}
                      {new Date(config.updatedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/diagnostico-push"
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
            >
              <Smartphone size={15} color="#2563eb" />
              <span>Diagnóstico Push</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchDeviceStatuses(colaboradores.map(c => c.id), false)}
              disabled={refreshingDevices}
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: refreshingDevices ? 'wait' : 'pointer',
              }}
              title="Atualizar status de aparelhos conectados no OneSignal"
            >
              <RefreshCw size={14} className={refreshingDevices ? 'animate-spin' : ''} />
              <span>{refreshingDevices ? 'Verificando...' : 'Atualizar Aparelhos'}</span>
            </button>

            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testingPush || config.selectedUserIds.length === 0}
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 12,
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: testingPush || config.selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
                opacity: config.selectedUserIds.length === 0 ? 0.55 : 1,
              }}
            >
              <Send size={14} />
              <span>{testingPush ? 'Enviando Teste...' : 'Testar Notificação'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                height: 40,
                padding: '0 18px',
                borderRadius: 12,
                border: 'none',
                background: hasChanges
                  ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                  : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: saving ? 'wait' : 'pointer',
                boxShadow: hasChanges
                  ? '0 6px 18px -3px rgba(22, 163, 74, 0.4)'
                  : '0 6px 16px -3px rgba(37, 99, 235, 0.3)',
              }}
            >
              <Save size={15} />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>

        {/* Banner de Permissão do Navegador atual (se ainda não ativado) */}
        {browserPermission === 'default' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #93c5fd',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bell size={18} color="#1d4ed8" />
              <div style={{ fontSize: 13, color: '#1e3a8a', fontWeight: 600 }}>
                Deseja receber notificações Push também neste computador/navegador? Ative a permissão com 1 clique.
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestBrowserPermission}
              disabled={requestingPermission}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#1d4ed8',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {requestingPermission ? 'Ativando...' : 'Ativar Neste Aparelho'}
            </button>
          </div>
        )}

        {/* Feedback de Teste ou Erro */}
        {feedbackBanner && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              background:
                feedbackBanner.type === 'success'
                  ? '#f0fdf4'
                  : feedbackBanner.type === 'warning'
                  ? '#fffbeb'
                  : '#fef2f2',
              border: `1px solid ${
                feedbackBanner.type === 'success'
                  ? '#86efac'
                  : feedbackBanner.type === 'warning'
                  ? '#fde68a'
                  : '#fca5a5'
              }`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 size={20} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} />
              ) : (
                <AlertTriangle
                  size={20}
                  color={feedbackBanner.type === 'warning' ? '#d97706' : '#dc2626'}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
              )}
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 800,
                    color:
                      feedbackBanner.type === 'success'
                        ? '#14532d'
                        : feedbackBanner.type === 'warning'
                        ? '#78350f'
                        : '#7f1d1d',
                  }}
                >
                  {feedbackBanner.title}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    marginTop: 3,
                    color:
                      feedbackBanner.type === 'success'
                        ? '#166534'
                        : feedbackBanner.type === 'warning'
                        ? '#92400e'
                        : '#991b1b',
                  }}
                >
                  {feedbackBanner.message}
                </div>
                {feedbackBanner.details && feedbackBanner.details.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#334155' }}>
                    {feedbackBanner.details.map((det, idx) => (
                      <li key={idx}>{det}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              aria-label="Fechar aviso"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* GATILHOS E CANAIS DE DISPARO (4 CARDS COM SWITCHES ACESSÍVEIS) */}
      <fieldset
        style={{
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 14,
        }}
      >
        <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Canais e Gatilhos de Notificação de Ocorrências
        </legend>

        {/* Card 1: Chave Geral */}
        <label
          htmlFor="sw-oc-enabled"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: config.enabled ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
            padding: '18px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 14,
            cursor: 'pointer',
            boxShadow: config.enabled ? '0 6px 18px -6px rgba(59, 130, 246, 0.16)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: config.enabled ? '#eff6ff' : '#f1f5f9',
                color: config.enabled ? '#2563eb' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bell size={19} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Notificações Push Ativas</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>
                Habilita o envio geral de alertas de ocorrências para a equipe selecionada.
              </div>
            </div>
          </div>
          <input
            id="sw-oc-enabled"
            name="enabled"
            type="checkbox"
            role="switch"
            checked={config.enabled}
            onChange={e => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
            style={{
              width: 20,
              height: 20,
              accentColor: '#2563eb',
              cursor: 'pointer',
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        </label>

        {/* Card 2: Nova Ocorrência */}
        <label
          htmlFor="sw-oc-new"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: config.notifyOnNewOcorrencia && config.enabled ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
            padding: '18px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 14,
            cursor: 'pointer',
            opacity: config.enabled ? 1 : 0.6,
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: config.notifyOnNewOcorrencia ? '#fffbeb' : '#f1f5f9',
                color: config.notifyOnNewOcorrencia ? '#d97706' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={19} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Novas Ocorrências</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>
                Notifica imediatamente quando uma ocorrência individual ou em lote é registrada.
              </div>
            </div>
          </div>
          <input
            id="sw-oc-new"
            name="notifyOnNewOcorrencia"
            type="checkbox"
            role="switch"
            checked={config.notifyOnNewOcorrencia}
            onChange={e => setConfig(prev => ({ ...prev, notifyOnNewOcorrencia: e.target.checked }))}
            style={{
              width: 20,
              height: 20,
              accentColor: '#d97706',
              cursor: 'pointer',
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        </label>

        {/* Card 3: Ciência Confirmada pela Família */}
        <label
          htmlFor="sw-oc-ciencia"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: config.notifyOnCienciaConfirmada && config.enabled ? '1.5px solid #10b981' : '1px solid #e2e8f0',
            padding: '18px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 14,
            cursor: 'pointer',
            opacity: config.enabled ? 1 : 0.6,
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: config.notifyOnCienciaConfirmada ? '#ecfdf5' : '#f1f5f9',
                color: config.notifyOnCienciaConfirmada ? '#059669' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={19} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Ciência dos Responsáveis</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>
                Notifica quando a família confirma a leitura e ciência da ocorrência no aplicativo.
              </div>
            </div>
          </div>
          <input
            id="sw-oc-ciencia"
            name="notifyOnCienciaConfirmada"
            type="checkbox"
            role="switch"
            checked={config.notifyOnCienciaConfirmada}
            onChange={e => setConfig(prev => ({ ...prev, notifyOnCienciaConfirmada: e.target.checked }))}
            style={{
              width: 20,
              height: 20,
              accentColor: '#059669',
              cursor: 'pointer',
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        </label>

        {/* Card 4: Som e Banner em Tempo Real */}
        <label
          htmlFor="sw-oc-sound"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: config.notifyRealtimeSound && config.enabled ? '1.5px solid #8b5cf6' : '1px solid #e2e8f0',
            padding: '18px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 14,
            cursor: 'pointer',
            opacity: config.enabled ? 1 : 0.6,
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: config.notifyRealtimeSound ? '#f5f3ff' : '#f1f5f9',
                color: config.notifyRealtimeSound ? '#7c3aed' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {config.notifyRealtimeSound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Alerta em Tela em Tempo Real</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>
                Exibe banner flutuante imediato na tela dos colaboradores selecionados conectados.
              </div>
            </div>
          </div>
          <input
            id="sw-oc-sound"
            name="notifyRealtimeSound"
            type="checkbox"
            role="switch"
            checked={config.notifyRealtimeSound}
            onChange={e => setConfig(prev => ({ ...prev, notifyRealtimeSound: e.target.checked }))}
            style={{
              width: 20,
              height: 20,
              accentColor: '#7c3aed',
              cursor: 'pointer',
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        </label>
      </fieldset>

      {/* PAINEL DE SELEÇÃO DE COLABORADORES */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 22,
          border: '1px solid #e2e8f0',
          padding: '24px 26px',
          boxShadow: '0 8px 26px -12px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Barra Superior de Busca e Ações em Massa */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="#2563eb" />
              <span>Marcar Colaboradores Autorizados a Receber Push</span>
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
              Clique nos cartões abaixo para ativar ou desativar o recebimento de notificações de ocorrências por colaborador.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={selectAllVisible}
              style={{
                padding: '7px 13px',
                borderRadius: 10,
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Check size={13} />
              <span>Marcar Visíveis ({filteredColaboradores.length})</span>
            </button>

            <button
              type="button"
              onClick={selectAllWithActiveDevice}
              style={{
                padding: '7px 13px',
                borderRadius: 10,
                border: '1px solid #bbf7d0',
                background: '#f0fdf4',
                color: '#15803d',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Smartphone size={13} />
              <span>Marcar c/ Aparelho Ativo ({categoryCounts.com_aparelho})</span>
            </button>

            <button
              type="button"
              onClick={clearVisibleSelection}
              style={{
                padding: '7px 13px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#475569',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Desmarcar Visíveis
            </button>
          </div>
        </div>

        {/* Busca + Filtros por Função */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={17}
              color="#94a3b8"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              id="search-colab-ocorrencias"
              name="searchColaborador"
              type="search"
              aria-label="Buscar colaborador por nome, cargo ou e-mail"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador por nome, cargo, setor ou e-mail..."
              style={{
                width: '100%',
                height: 44,
                paddingLeft: 42,
                paddingRight: searchTerm ? 38 : 16,
                borderRadius: 13,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: 14,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: '#e2e8f0',
                  color: '#475569',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Chips de Filtro */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
              <Filter size={12} /> Filtrar:
            </span>
            {filterChips.map(chip => {
              const active = categoryFilter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCategoryFilter(chip.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: active ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: active ? '#eff6ff' : '#ffffff',
                    color: active ? '#1d4ed8' : '#475569',
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{chip.label}</span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 800,
                      background: active ? '#2563eb' : '#f1f5f9',
                      color: active ? '#ffffff' : '#64748b',
                    }}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista / Grid de Colaboradores */}
        {loadingColabs || loadingConfig ? (
          <div
            style={{
              padding: '48px 20px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Carregando lista de colaboradores e status de aparelhos no OneSignal...
          </div>
        ) : filteredColaboradores.length === 0 ? (
          <div
            style={{
              padding: '44px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px dashed #cbd5e1',
              color: '#64748b',
            }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Nenhum colaborador encontrado para este filtro
            </div>
            <div style={{ fontSize: 12.5 }}>
              Tente limpar o termo de busca ou selecionar a aba &ldquo;Todos&rdquo;.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: 12,
            }}
          >
            {filteredColaboradores.map(colab => {
              const selected = isColabSelected(colab)
              const dev = getColabDeviceStatus(colab)
              const isMe =
                Boolean(currentUser?.id) &&
                (currentUser?.id === colab.id ||
                  currentUser?.id === colab.auth_id ||
                  (currentUser?.email &&
                    colab.email &&
                    currentUser.email.toLowerCase() === colab.email.toLowerCase()))

              const inputId = `colab-oc-push-${colab.id}`

              return (
                <label
                  key={colab.id}
                  htmlFor={inputId}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 16,
                    border: selected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selected
                      ? 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)'
                      : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.16s ease',
                    boxShadow: selected ? '0 6px 16px -6px rgba(37, 99, 235, 0.2)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                    {/* Avatar / Iniciais */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {colab.foto ? (
                        <img
                          src={colab.foto}
                          alt={colab.nome}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            objectFit: 'cover',
                            border: selected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            background: selected
                              ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
                              : '#f1f5f9',
                            color: selected ? '#ffffff' : '#475569',
                            fontWeight: 800,
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {getInitials(colab.nome)}
                        </div>
                      )}

                      {selected && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: -3,
                            right: -3,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#16a34a',
                            color: '#ffffff',
                            border: '2px solid #ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>

                    {/* Dados do Colaborador */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: 800,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}
                        >
                          {colab.nome}
                        </span>
                        {isMe && (
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: '#dbeafe',
                              color: '#1e40af',
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            VOCÊ
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#2563eb',
                          marginTop: 2,
                        }}
                      >
                        {colab.cargo}
                        {colab.perfil && colab.perfil.toLowerCase() !== colab.cargo.toLowerCase()
                          ? ` • ${colab.perfil}`
                          : ''}
                      </div>

                      {colab.email && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#64748b',
                            marginTop: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {colab.email}
                        </div>
                      )}

                      {/* Badges de Aparelhos Ativos no OneSignal */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                        {dev.hasActiveDevice ? (
                          <>
                            {dev.iosCount > 0 && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                <Smartphone size={11} />
                                {dev.iosCount} iOS
                              </span>
                            )}
                            {dev.androidCount > 0 && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  color: '#15803d',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                <Smartphone size={11} />
                                {dev.androidCount} Android
                              </span>
                            )}
                            {dev.webCount > 0 && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: '#f5f3ff',
                                  border: '1px solid #ddd6fe',
                                  color: '#6d28d9',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                <Laptop size={11} />
                                {dev.webCount} Web
                              </span>
                            )}
                          </>
                        ) : (
                          <span
                            title="Este colaborador receberá alertas em tela quando estiver online, mas ainda não ativou notificações Push no celular ou navegador."
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 7px',
                              borderRadius: 6,
                              background: '#fffbeb',
                              border: '1px solid #fde68a',
                              color: '#b45309',
                              fontSize: 10.5,
                              fontWeight: 700,
                            }}
                          >
                            <Info size={11} />
                            Sem aparelho Push vinculado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Checkbox Switch Acessível */}
                  <input
                    id={inputId}
                    name={`colab_${colab.id}`}
                    type="checkbox"
                    role="switch"
                    checked={selected}
                    onChange={() => toggleCollaborator(colab)}
                    style={{
                      width: 20,
                      height: 20,
                      accentColor: '#2563eb',
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* BARRA FLUTUANTE DE ALTERAÇÕES NÃO SALVAS */}
      {hasChanges && (
        <div
          style={{
            position: 'fixed',
            bottom: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(12px)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 18,
            boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.45)',
            border: '1px solid rgba(255,255,255,0.14)',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
            maxWidth: '92vw',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#f59e0b',
                boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.25)',
              }}
            />
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>
              Alterações pendentes ({categoryCounts.selecionados} colaborador(es) selecionado(s))
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={discardChanges}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#cbd5e1',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Save size={14} />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE SALVAMENTO */}
      {showSaveSuccessModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="oc-push-save-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowSaveSuccessModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 24,
              padding: '28px 30px',
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              textAlign: 'center',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={30} />
            </div>

            <h3
              id="oc-push-save-modal-title"
              style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}
            >
              Configurações Salvas com Sucesso!
            </h3>

            <p style={{ margin: '10px 0 20px', fontSize: 13.5, color: '#475569', lineHeight: 1.55 }}>
              {config.enabled
                ? `${categoryCounts.selecionados} colaborador(es) estão configurados para receber as notificações Push de ocorrências disciplinares em tempo real.`
                : 'O envio de notificações Push de ocorrências para colaboradores foi pausado.'}
            </p>

            <button
              type="button"
              onClick={() => setShowSaveSuccessModal(false)}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
