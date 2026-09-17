'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Bell,
  BellRing,
  Settings,
  UserCheck,
  Send,
  Radio,
  Terminal,
  ChevronDown,
  ChevronUp,
  Cpu,
  KeyRound,
  ShieldAlert,
  Info,
} from 'lucide-react'
import { notificationService } from '@/lib/notifications/notificationService'
import type { DetailedDeviceDiagnostic } from '@/lib/notifications/types'
import { useApp } from '@/lib/context'
import { toast } from 'sonner'

interface DevicePushDiagnosticCardProps {
  title?: string
  description?: string
  className?: string
  showActions?: boolean
  showAuditLogs?: boolean
}

export function DevicePushDiagnosticCard({
  title = 'Auditoria Nativa de Push do Dispositivo',
  description = 'Diagnóstico em tempo real interrogando diretamente o SDK OneSignal nativo e o sistema operacional (iOS/Android).',
  className = '',
  showActions = true,
  showAuditLogs = true,
}: DevicePushDiagnosticCardProps) {
  const { currentUser } = useApp()
  const [diagnostic, setDiagnostic] = useState<DetailedDeviceDiagnostic | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const loadDiagnostic = useCallback(async () => {
    setLoading(true)
    setActionFeedback(null)
    try {
      const data = await notificationService.getDetailedDeviceDiagnostics(currentUser)
      setDiagnostic(data)
    } catch (err: any) {
      console.error('[DevicePushDiagnosticCard] Erro ao carregar diagnóstico:', err)
      toast.error('Falha ao consultar estado nativo do aparelho.')
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    loadDiagnostic()
  }, [loadDiagnostic])

  // Helper seguro para cópia universal (iOS WKWebView, Safari, Desktop)
  const copyText = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        setCopiedField(label)
        toast.success(`${label} copiado!`)
        setTimeout(() => setCopiedField(null), 2000)
        return
      }
    } catch {}

    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      textArea.remove()
      if (success) {
        setCopiedField(label)
        toast.success(`${label} copiado!`)
        setTimeout(() => setCopiedField(null), 2000)
      } else {
        toast.error('Não foi possível copiar automaticamente.')
      }
    } catch {
      toast.error('Erro ao acessar a área de transferência.')
    }
  }

  const handleCopyFullReport = async () => {
    if (!diagnostic) return
    const formattedSummary = `=== RELATÓRIO DE AUDITORIA ONESIGNAL / IOS ===
Data/Hora: ${diagnostic.timestamp}
Plataforma: ${diagnostic.platform.toUpperCase()} (Nativo: ${diagnostic.isNative ? 'SIM' : 'NÃO'})
App: ${diagnostic.appInfo.name} (${diagnostic.appInfo.id})
Versão: ${diagnostic.appInfo.version} (Build ${diagnostic.appInfo.build})
OneSignal App ID: ${diagnostic.oneSignalAppId}

[INSCRIÇÃO ONESIGNAL DO APARELHO]
Subscription ID: ${diagnostic.subscriptionId || '(NENHUM - DISPOSITIVO NÃO REGISTRADO)'}
OneSignal ID: ${diagnostic.oneSignalId || '(indisponível)'}
External ID Atual: ${diagnostic.externalId || '(VAZIO - ANÔNIMO)'}
Opted In: ${diagnostic.pushSubscription.optedIn ? 'SIM' : 'NÃO'}
Push Token: ${diagnostic.pushSubscription.tokenMasked || '(NENHUM TOKEN GERADO)'} (${diagnostic.pushSubscription.tokenType}, ${diagnostic.pushSubscription.tokenLength} chars)

[USUÁRIO AUTENTICADO NO APP]
ID Usuário: ${diagnostic.currentUser?.id || '(Nenhum logado)'}
Nome: ${diagnostic.currentUser?.nome || '-'}
Email: ${diagnostic.currentUser?.email || '-'}
Perfil / Cargo: ${diagnostic.currentUser?.perfil || '-'} / ${diagnostic.currentUser?.cargo || '-'}
Responsável ID: ${diagnostic.currentUser?.responsavelId || '-'}
Aluno ID: ${diagnostic.currentUser?.alunoId || '-'}
Status Vínculo: ${diagnostic.identityMatch.details}

[PERMISSÃO DO SISTEMA OPERACIONAL]
Status: ${diagnostic.permission.permissionStatus}
Código Nativo iOS: ${diagnostic.permission.nativePermissionCode ?? 'N/A'} (${diagnostic.permission.nativePermissionLabel})
Has Permission: ${diagnostic.permission.hasPermission ? 'SIM' : 'NÃO'}
Can Request Permission: ${diagnostic.permission.canRequestPermission ? 'SIM' : 'NÃO'}

[HISTÓRICO RECENTE DE EVENTOS]
${(diagnostic.auditLogs || []).map(l => `[${l.timestamp}] ${l.action} -> ${l.status.toUpperCase()} ${l.error ? `(${l.error})` : ''}`).join('\n')}

=== FIM DO RELATÓRIO ===`

    await copyText(formattedSummary, 'Relatório completo de diagnóstico')
  }

  // Ações de intervenção
  const handleRequestNativePermission = async () => {
    setActionLoading('perm')
    setActionFeedback(null)
    try {
      const res = await notificationService.forceNativePermission()
      if (res.accepted) {
        setActionFeedback({ type: 'success', message: 'Permissão concedida pelo usuário no sistema operacional!' })
        toast.success('Permissão concedida no sistema operacional!')
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Permissão não concedida ou negada pelo usuário.' })
        toast.error('Permissão não concedida.')
      }
    } catch (e: any) {
      setActionFeedback({ type: 'error', message: e?.message || 'Erro ao solicitar permissão.' })
    } finally {
      setActionLoading(null)
      await loadDiagnostic()
    }
  }

  const handleOpenSettings = async () => {
    setActionLoading('settings')
    try {
      await notificationService.openNotificationSettings()
      toast.info('Abrindo os Ajustes do aplicativo...')
    } catch {
      toast.error('Não foi possível abrir os Ajustes automaticamente.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleForceIdentity = async () => {
    if (!currentUser?.id) {
      toast.error('Nenhum usuário autenticado no app para vincular.')
      return
    }
    setActionLoading('identity')
    setActionFeedback(null)
    try {
      const res = await notificationService.forceUserLogin(currentUser)
      if (res.success) {
        setActionFeedback({ type: 'success', message: `Usuário associado com sucesso! External ID: ${res.externalIdFound}` })
        toast.success(`External ID vinculado: ${res.externalIdFound}`)
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Falha ao vincular usuário no OneSignal.' })
        toast.error('Falha ao associar usuário.')
      }
    } catch (e: any) {
      setActionFeedback({ type: 'error', message: e?.message || 'Erro ao forçar associação.' })
    } finally {
      setActionLoading(null)
      await loadDiagnostic()
    }
  }

  const handleForceBackendSync = async () => {
    setActionLoading('backend')
    setActionFeedback(null)
    try {
      const res = await notificationService.forceBackendSync(currentUser)
      if (res.success) {
        setActionFeedback({ type: 'success', message: 'Subscrição sincronizada com o backend via REST API com sucesso!' })
        toast.success('Subscrição sincronizada no backend!')
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Falha na sincronização com backend.' })
        toast.error(res.error || 'Falha na sincronização.')
      }
    } catch (e: any) {
      setActionFeedback({ type: 'error', message: e?.message || 'Erro de rede.' })
    } finally {
      setActionLoading(null)
      await loadDiagnostic()
    }
  }

  const handleSendTestPush = async () => {
    setActionLoading('testpush')
    setActionFeedback(null)
    try {
      const res = await notificationService.sendTestPushToThisDevice(
        '🔔 Teste de Notificação no Aparelho',
        `Disparo de teste ao vivo recebido com sucesso! (${new Date().toLocaleTimeString('pt-BR')})`
      )
      if (res.success) {
        setActionFeedback({ type: 'success', message: `Notificação enviada com sucesso ao OneSignal! ID: ${res.response?.notificationId || 'OK'}` })
        toast.success('Push de teste disparado para este aparelho!')
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Falha ao disparar push.' })
        toast.error(res.error || 'Erro ao disparar push de teste.')
      }
    } catch (e: any) {
      setActionFeedback({ type: 'error', message: e?.message || 'Erro ao enviar push.' })
    } finally {
      setActionLoading(null)
    }
  }

  const isIos = diagnostic?.platform === 'ios'
  const isPermAuthorized = diagnostic?.permission.permissionStatus === 'authorized'
  const isPermDenied = diagnostic?.permission.permissionStatus === 'denied'
  const isPermNotDetermined = diagnostic?.permission.permissionStatus === 'notDetermined'
  const hasSubId = Boolean(diagnostic?.subscriptionId)
  const isMatched = Boolean(diagnostic?.identityMatch.isMatched)

  return (
    <div className={`rounded-2xl border border-slate-700/70 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-950 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  diagnostic?.isNative
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {diagnostic?.isNative ? (isIos ? ' iOS Nativo' : 'Android Nativo') : 'Navegador Web'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDiagnostic}
              disabled={loading || Boolean(actionLoading)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
              title="Recarregar dados do SDK agora"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={handleCopyFullReport}
              disabled={!diagnostic || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition disabled:opacity-50"
              title="Copiar relatório completo formatado para colar na conversa"
            >
              {copiedField === 'Relatório completo de diagnóstico' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Diagnóstico
                </>
              )}
            </button>
          </div>
        </div>

        {/* Banner de Diagnóstico Rápido */}
        <div className="mt-4">
          {isPermAuthorized && hasSubId && isMatched ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-200">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <span className="font-semibold text-emerald-300">Dispositivo Pronto e Vinculado:</span> Notificações autorizadas, token push gerado e External ID vinculado à conta.
              </div>
            </div>
          ) : isPermDenied ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
              <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
              <div className="flex-1">
                <span className="font-semibold text-rose-300">Notificações Bloqueadas nos Ajustes:</span> O iOS não permite exibir avisos push enquanto o app estiver desativado nas Configurações do iPhone.
              </div>
              <button
                onClick={handleOpenSettings}
                className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500 transition"
              >
                Abrir Ajustes
              </button>
            </div>
          ) : isPermNotDetermined ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
              <div className="flex-1">
                <span className="font-semibold text-amber-300">Permissão Nunca Solicitada (Never Prompted):</span> O alerta nativo do iOS ainda não foi respondido.
              </div>
              <button
                onClick={handleRequestNativePermission}
                disabled={Boolean(actionLoading)}
                className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500 transition"
              >
                Ativar Agora
              </button>
            </div>
          ) : !isMatched ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-orange-500/40 bg-orange-950/40 p-3 text-xs text-orange-200">
              <UserCheck className="h-5 w-5 shrink-0 text-orange-400" />
              <div className="flex-1">
                <span className="font-semibold text-orange-300">External ID Não Vinculado:</span> O aparelho está registrado como anônimo no OneSignal.
              </div>
              <button
                onClick={handleForceIdentity}
                disabled={Boolean(actionLoading) || !currentUser?.id}
                className="shrink-0 rounded-lg bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-500 transition"
              >
                Vincular Usuário
              </button>
            </div>
          ) : null}
        </div>

        {/* Feedback de Ação */}
        {actionFeedback && (
          <div className={`mt-3 rounded-lg border p-2.5 text-xs flex items-center gap-2 ${
            actionFeedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}>
            <Info className="h-4 w-4 shrink-0" />
            <span>{actionFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Grid de Informações Técnicas */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Seção 1: Identificadores OneSignal */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-indigo-400" />
            1. Identificadores OneSignal no Aparelho
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Subscription ID (O mais crítico) */}
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 relative group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                  Subscription ID Atual (Físico)
                </span>
                {diagnostic?.subscriptionId && (
                  <button
                    onClick={() => copyText(diagnostic.subscriptionId!, 'Subscription ID')}
                    className="text-indigo-400 hover:text-white transition p-1"
                    title="Copiar apenas o Subscription ID"
                  >
                    {copiedField === 'Subscription ID' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              <p className="font-mono text-xs font-medium text-white break-all select-all">
                {diagnostic?.subscriptionId || <span className="text-rose-400 font-sans italic">Não registrado no SDK</span>}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                * Compare este ID com a coluna Subscription ID no painel do OneSignal.
              </p>
            </div>

            {/* External ID Atual */}
            <div className={`rounded-xl border p-3 ${
              isMatched
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : 'border-rose-500/30 bg-rose-950/20'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  External ID Atual no SDK
                </span>
                {diagnostic?.externalId && (
                  <button
                    onClick={() => copyText(diagnostic.externalId!, 'External ID')}
                    className="text-slate-400 hover:text-white transition p-1"
                    title="Copiar External ID"
                  >
                    {copiedField === 'External ID' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              <p className="font-mono text-xs font-medium text-white break-all">
                {diagnostic?.externalId || <span className="text-rose-400 font-sans font-bold">VAZIO (Dispositivo Anônimo)</span>}
              </p>
              <p className="text-[10px] mt-1 text-slate-400">
                {diagnostic?.identityMatch.details}
              </p>
            </div>

            {/* OneSignal ID */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                OneSignal User ID (v5)
              </span>
              <p className="font-mono text-xs text-slate-300 break-all">
                {diagnostic?.oneSignalId || <span className="text-slate-500">Não disponível</span>}
              </p>
            </div>

            {/* OneSignal App ID */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                OneSignal App ID
              </span>
              <p className="font-mono text-xs text-slate-300 break-all">
                {diagnostic?.oneSignalAppId}
              </p>
            </div>
          </div>
        </div>

        {/* Seção 2: Permissão e Token Push */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
            2. Permissão do Sistema & Token Push
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status Nativo de Permissão */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Permissão iOS
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                  isPermAuthorized ? 'bg-emerald-400' : isPermDenied ? 'bg-rose-500' : 'bg-amber-400'
                }`} />
                <p className="text-xs font-bold text-white">
                  {diagnostic?.permission.nativePermissionLabel}
                </p>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Código nativo: {diagnostic?.permission.nativePermissionCode ?? 'N/A'}
              </p>
            </div>

            {/* Opted In */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Estado Opted In
              </span>
              <p className={`text-xs font-bold ${
                diagnostic?.pushSubscription.optedIn ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {diagnostic?.pushSubscription.optedIn ? '✅ Opted In (Ativo)' : '❌ Opted Out (Inativo)'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                canRequestPermission: {diagnostic?.permission.canRequestPermission ? 'true' : 'false'}
              </p>
            </div>

            {/* Token Push */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Token Push ({diagnostic?.pushSubscription.tokenType})
              </span>
              <p className="font-mono text-xs font-medium text-white">
                {diagnostic?.pushSubscription.hasToken ? (
                  <span className="text-emerald-300">{diagnostic.pushSubscription.tokenMasked}</span>
                ) : (
                  <span className="text-rose-400">Ausente</span>
                )}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {diagnostic?.pushSubscription.tokenLength ? `${diagnostic.pushSubscription.tokenLength} caracteres` : 'Sem token registrado pelo SO'}
              </p>
            </div>

            {/* Versão e Build do App */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Versão e Build Instalada
              </span>
              <p className="text-xs font-bold text-white">
                v{diagnostic?.appInfo.version} (Build {diagnostic?.appInfo.build})
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                {diagnostic?.appInfo.id}
              </p>
            </div>
          </div>
        </div>

        {/* Seção 3: Dados do Usuário Autenticado */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
            3. Usuário Autenticado na Sessão Atual
          </h4>
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            {diagnostic?.currentUser?.id ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Nome:</span>
                  <span className="font-semibold text-white">{diagnostic.currentUser.nome || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Email:</span>
                  <span className="font-mono text-white truncate">{diagnostic.currentUser.email || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Perfil / Cargo:</span>
                  <span className="text-white">{diagnostic.currentUser.perfil || '-'} ({diagnostic.currentUser.cargo || '-'})</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">User ID:</span>
                  <span className="font-mono text-slate-300 break-all">{diagnostic.currentUser.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Responsável ID:</span>
                  <span className="font-mono text-slate-300">{diagnostic.currentUser.responsavelId || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Aluno ID:</span>
                  <span className="font-mono text-slate-300">{diagnostic.currentUser.alunoId || '-'}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-400 flex items-center gap-2 py-1">
                <AlertTriangle className="h-4 w-4" />
                Nenhum usuário autenticado no app neste momento (sessão anônima na tela de login).
              </div>
            )}
          </div>
        </div>

        {/* Seção 4: Ações Rápidas de Intervenção */}
        {showActions && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              4. Ações Interativas de Recuperação e Teste
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Solicitar Permissão Nativa */}
              <button
                onClick={handleRequestNativePermission}
                disabled={Boolean(actionLoading)}
                className="flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-900/30 hover:bg-indigo-900/60 p-3 text-xs font-semibold text-indigo-200 transition disabled:opacity-50"
              >
                <BellRing className="h-4 w-4 text-indigo-400" />
                {actionLoading === 'perm' ? 'Solicitando...' : 'Solicitar Permissão SO'}
              </button>

              {/* Abrir Ajustes do iPhone */}
              <button
                onClick={handleOpenSettings}
                disabled={Boolean(actionLoading)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700 p-3 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                {actionLoading === 'settings' ? 'Abrindo...' : 'Abrir Ajustes do iPhone'}
              </button>

              {/* Forçar Vínculo de Usuário */}
              <button
                onClick={handleForceIdentity}
                disabled={Boolean(actionLoading) || !currentUser?.id}
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/50 p-3 text-xs font-semibold text-emerald-200 transition disabled:opacity-50"
              >
                <UserCheck className="h-4 w-4 text-emerald-400" />
                {actionLoading === 'identity' ? 'Vinculando...' : 'Forçar Vínculo OneSignal'}
              </button>

              {/* Disparar Push para este Dispositivo */}
              <button
                onClick={handleSendTestPush}
                disabled={Boolean(actionLoading) || !diagnostic?.subscriptionId}
                className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 p-3 text-xs font-bold text-purple-200 transition shadow-lg shadow-purple-950/50 disabled:opacity-50"
              >
                <Send className="h-4 w-4 text-purple-400" />
                {actionLoading === 'testpush' ? 'Enviando...' : 'Disparar Push p/ Este Aparelho'}
              </button>
            </div>
          </div>
        )}

        {/* Seção 5: Auditoria e Logs em Tempo Real */}
        {showAuditLogs && (
          <div className="border-t border-slate-800/80 pt-4">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                Histórico de Auditoria do Dispositivo ({diagnostic?.auditLogs?.length || 0} eventos)
              </span>
              {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showLogs && (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 max-h-56 overflow-y-auto space-y-1.5">
                {(!diagnostic?.auditLogs || diagnostic.auditLogs.length === 0) ? (
                  <p className="text-slate-500 italic">Nenhum evento de auditoria registrado nesta sessão.</p>
                ) : (
                  diagnostic.auditLogs.slice().reverse().map((log) => (
                    <div key={log.id} className="flex items-start gap-2 border-b border-slate-900/80 pb-1">
                      <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                      <span className={`px-1 rounded text-[9px] uppercase font-bold shrink-0 ${
                        log.status === 'ok' ? 'bg-emerald-500/20 text-emerald-300' :
                        log.status === 'error' ? 'bg-rose-500/20 text-rose-300' :
                        log.status === 'pending' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {log.status}
                      </span>
                      <span className="text-indigo-300 shrink-0">{log.action}:</span>
                      <span className="text-slate-300 break-all">
                        {log.error ? <span className="text-rose-400">{log.error}</span> : JSON.stringify(log.details || {})}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
