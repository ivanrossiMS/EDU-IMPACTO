'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Send,
  Smartphone,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  FileText,
  RefreshCw,
  X,
  ExternalLink,
  Calculator,
  HandCoins,
  ShieldCheck
} from 'lucide-react'
import {
  CredImpactoEmprestimo,
  CredImpactoNotificationItem,
  CredImpactoPushEventType
} from '@/types/credimpacto'
import { formatBrl } from '@/lib/credimpacto/engine'
import { notificationService } from '@/lib/notifications/notificationService'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────────────────
// HELPER DE TEMPLATES NO CLIENTE PARA PREVIEW E EDIÇÃO RÁPIDA PELO ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export function getClientPushTemplate(
  eventType: CredImpactoPushEventType,
  loan: CredImpactoEmprestimo
): { title: string; message: string } {
  const codigo = loan.codigoOperacao || 'CREDIMPACTO'
  const primeiroNome = (loan.colaboradorNome || 'Colaborador').split(' ')[0]
  const valor = loan.valorAprovado && loan.valorAprovado > 0 ? loan.valorAprovado : loan.valorSolicitado
  const valorFmt = formatBrl(valor || 0)
  const parcelas = loan.quantidadeParcelas || 1
  const valorParc = loan.parcelas?.[0]?.valorTotal || (parcelas > 0 ? valor / parcelas : valor)
  const valorParcFmt = formatBrl(valorParc || 0)

  switch (eventType) {
    case 'simulacao_realizada':
      return {
        title: `📊 Simulação CredImpacto (${valorFmt})`,
        message: `Olá, ${primeiroNome}! Sua simulação de ${valorFmt} em ${parcelas}x de ${valorParcFmt} está disponível no portal CredImpacto.`
      }
    case 'em_analise':
    case 'solicitacao_nova':
      return {
        title: `🔍 Solicitação em Análise (${codigo})`,
        message: `Olá, ${primeiroNome}! Sua proposta de ${valorFmt} em ${parcelas}x está em análise pelo setor financeiro.`
      }
    case 'aprovado_aguardando_assinatura':
      return {
        title: `🎉 Empréstimo Aprovado! Assine seu Contrato (${codigo})`,
        message: `Boa notícia, ${primeiroNome}! Seu empréstimo de ${valorFmt} em ${parcelas}x foi aprovado. Acesse o CredImpacto para assinar digitalmente e liberar o PIX!`
      }
    case 'aprovado_aguardando_liberacao':
      return {
        title: `✅ Empréstimo Aprovado! (${codigo})`,
        message: `Parabéns, ${primeiroNome}! Seu empréstimo de ${valorFmt} em ${parcelas}x foi aprovado e já está na fila para transferência PIX/TED.`
      }
    case 'contraproposta_enviada': {
      const vProp = loan.contraproposta?.valorProposto || valor
      const pProp = loan.contraproposta?.quantidadeParcelas || parcelas
      return {
        title: `💡 Nova Contraproposta Disponível (${codigo})`,
        message: `Olá, ${primeiroNome}! O financeiro enviou uma contraproposta de ${formatBrl(vProp)} em ${pProp}x. Toque para avaliar e responder no portal!`
      }
    }
    case 'recursos_liberados':
    case 'aprovado_ativo': {
      const pix = loan.dadosBancarios?.chavePix || loan.colaboradorCpf || 'sua conta'
      return {
        title: `💸 Dinheiro na Conta! Recursos Liberados (${codigo})`,
        message: `Olá, ${primeiroNome}! A transferência de ${valorFmt} foi efetuada para ${pix}. Confira o comprovante e seu cronograma no portal!`
      }
    }
    case 'lembrete_parcela': {
      const prox = (loan.parcelas || []).find((p) => p.status === 'prevista' || p.status === 'exportada_folha')
      const num = prox?.numero || 1
      const comp = prox?.competencia ? ` (${prox.competencia})` : ''
      const vP = formatBrl(prox?.valorTotal || valorParc)
      return {
        title: `📅 Lembrete de Parcela CredImpacto (${codigo})`,
        message: `Olá, ${primeiroNome}! Lembrete referente à parcela ${num}/${parcelas}${comp} no valor de ${vP} do contrato ${codigo}.`
      }
    }
    case 'parcela_conciliada': {
      const pagas = (loan.parcelas || []).filter((p) => p.status === 'descontada' || p.status === 'paga_avulso')
      const ult = pagas[pagas.length - 1]
      const num = ult?.numero || 1
      const comp = ult?.competencia ? ` (${ult.competencia})` : ''
      const vP = formatBrl(ult?.valorPago || ult?.valorTotal || valorParc)
      return {
        title: `🧾 Parcela ${String(num).padStart(2, '0')}/${String(parcelas).padStart(2, '0')} Quitada (${codigo})`,
        message: `Olá, ${primeiroNome}! A parcela ${num}/${parcelas}${comp} no valor de ${vP} foi baixada com sucesso no seu contrato ${codigo}.`
      }
    }
    case 'quitacao_confirmada':
      return {
        title: `🎉 Empréstimo 100% Quitado! (${codigo})`,
        message: `Parabéns, ${primeiroNome}! Seu contrato ${codigo} foi 100% quitado e todas as parcelas futuras foram encerradas.`
      }
    case 'recusado':
      return {
        title: `⚠️ Atualização da Solicitação (${codigo})`,
        message: `Olá, ${primeiroNome}. Sua solicitação de ${valorFmt} não pôde ser aprovada neste momento. ${loan.motivoRecusa ? `Motivo: ${loan.motivoRecusa}` : 'Consulte os detalhes no portal.'}`
      }
    default:
      return {
        title: `🔔 Atualização CredImpacto (${codigo})`,
        message: `Olá, ${primeiroNome}! Há uma nova atualização referente à sua operação ${codigo} (${valorFmt} em ${parcelas}x) no portal CredImpacto.`
      }
  }
}

export function getDefaultEventTypeForLoanStatus(loan: CredImpactoEmprestimo): CredImpactoPushEventType {
  switch (loan.status) {
    case 'solicitado':
    case 'em_analise':
      return 'em_analise'
    case 'contraproposta':
      return 'contraproposta_enviada'
    case 'aprovado':
    case 'aguardando_assinatura':
      return 'aprovado_aguardando_assinatura'
    case 'aguardando_liberacao':
      return 'aprovado_aguardando_liberacao'
    case 'ativo':
      return 'recursos_liberados'
    case 'quitado':
      return 'quitacao_confirmada'
    case 'recusado':
      return 'recusado'
    default:
      return 'aviso_personalizado'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SINO E CENTRAL DE NOTIFICAÇÕES PUSH (CREDIMPACTO HEADER)
// ─────────────────────────────────────────────────────────────────────────────

interface CredImpactoNotificationBellProps {
  isAdminOrFinance: boolean
  viewMode: 'admin' | 'colaborador'
  currentUserId?: string
  onNavigateToLoan?: (emprestimoId?: string, targetUrl?: string) => void
}

export function CredImpactoNotificationBell({
  isAdminOrFinance,
  viewMode,
  onNavigateToLoan
}: CredImpactoNotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notificacoes, setNotificacoes] = useState<CredImpactoNotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filterTab, setFilterTab] = useState<'todas' | 'nao_lidas' | 'enviadas'>('todas')
  const [myDeviceStatus, setMyDeviceStatus] = useState<{
    hasActiveDevice: boolean
    deviceCount: number
  } | null>(null)
  const [browserPermission, setBrowserPermission] = useState<string>('default')
  const [isTestingPush, setIsTestingPush] = useState(false)
  const [isActivatingPush, setIsActivatingPush] = useState(false)

  const fetchNotifications = useCallback(
    async (checkDevices = false) => {
      try {
        if (checkDevices) setLoading(true)
        const res = await fetch(
          `/api/credimpacto/push?viewMode=${viewMode}${checkDevices ? '&checkDevices=1' : ''}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data.notificacoes)) {
          setNotificacoes(data.notificacoes)
        }
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount)
        }
        if (data.myDeviceStatus) {
          setMyDeviceStatus(data.myDeviceStatus)
        }
      } catch (err) {
        console.warn('[CredImpactoNotificationBell] erro ao carregar:', err)
      } finally {
        if (checkDevices) setLoading(false)
      }
    },
    [viewMode]
  )

  useEffect(() => {
    fetchNotifications(false)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission)
    }

    const handlePushReceived = () => {
      fetchNotifications(false)
    }
    window.addEventListener('credimpacto:push-received', handlePushReceived)
    const interval = setInterval(() => fetchNotifications(false), 30000)

    return () => {
      window.removeEventListener('credimpacto:push-received', handlePushReceived)
      clearInterval(interval)
    }
  }, [fetchNotifications])

  const handleOpenModal = () => {
    setOpen(true)
    fetchNotifications(true)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/credimpacto/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'marcar_todas_lidas' })
      })
      setUnreadCount(0)
      fetchNotifications(false)
      toast.success('Todas as notificações foram marcadas como lidas!')
    } catch {}
  }

  const handleActivatePushOnDevice = async () => {
    setIsActivatingPush(true)
    try {
      const granted = await notificationService.requestNotificationPermission()
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setBrowserPermission(Notification.permission)
      }
      if (granted) {
        toast.success('Notificações Push ativadas e sincronizadas neste aparelho!')
        setTimeout(() => fetchNotifications(true), 1200)
      } else {
        toast.warning('Permissão de notificação não concedida no navegador/aparelho.')
      }
    } catch (err: any) {
      toast.error('Erro ao ativar notificações push neste aparelho.')
    } finally {
      setIsActivatingPush(false)
    }
  }

  const handleTestPush = async () => {
    setIsTestingPush(true)
    try {
      const res = await fetch('/api/credimpacto/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'testar',
          targetRole: isAdminOrFinance && viewMode === 'admin' ? 'admin' : 'colaborador'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no disparo de teste')
      toast.success(
        data.devicesReached > 0
          ? `Push de teste enviado com sucesso para ${data.devicesReached} aparelho(s)!`
          : 'Notificação de teste disparada! Confira o banner no topo da tela.'
      )
      fetchNotifications(true)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar Push')
    } finally {
      setIsTestingPush(false)
    }
  }

  const handleClickNotification = async (item: CredImpactoNotificationItem) => {
    try {
      fetch('/api/credimpacto/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'marcar_lida', notificationId: item.id })
      }).catch(() => {})
    } catch {}

    setOpen(false)
    if (onNavigateToLoan) {
      onNavigateToLoan(item.emprestimoId, item.targetUrl)
    }
  }

  const filteredList = notificacoes.filter((n) => {
    if (filterTab === 'enviadas') {
      return n.recipientRole === 'colaborador'
    }
    if (isAdminOrFinance && viewMode === 'admin') {
      // Na aba principal do admin, foca nos alertas recebidos pelo admin ou todos se 'todas'
      if (filterTab === 'nao_lidas') {
        return n.recipientRole === 'admin'
      }
    }
    return true
  })

  const isDeviceConnected = Boolean(myDeviceStatus?.hasActiveDevice || browserPermission === 'granted')

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50/70 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-xs font-bold transition-all shadow-xs"
        title="Central de Notificações Push do CredImpacto"
      >
        <div className="relative">
          {unreadCount > 0 ? (
            <BellRing size={15} className="text-emerald-600 dark:text-emerald-400 animate-bounce" />
          ) : (
            <Bell size={15} className="text-slate-600 dark:text-slate-300" />
          )}
          <span
            className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-slate-800 ${
              isDeviceConnected ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
            title={isDeviceConnected ? 'Push Ativo neste Aparelho' : 'Clique para ativar Push neste Aparelho'}
          />
        </div>
        <span className="hidden sm:inline">Push</span>
        {unreadCount > 0 && (
          <span className="px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white font-mono text-[10px] font-extrabold flex items-center justify-center shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[88vh]">
            {/* CABEÇALHO */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <BellRing size={19} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Notificações Push CredImpacto</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                        {unreadCount} nova(s)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Alertas em tempo real de solicitações, aprovações, contrapropostas e folha
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* BARRA DE STATUS DO APARELHO & TESTE PUSH */}
            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isDeviceConnected
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <Smartphone size={16} />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>
                      {isDeviceConnected ? 'Push Ativo neste Aparelho' : 'Ative o Push neste Aparelho'}
                    </span>
                    {myDeviceStatus && myDeviceStatus.deviceCount > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {myDeviceStatus.deviceCount} disp.
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isDeviceConnected
                      ? 'Você receberá alertas sonoros e notificações nativas.'
                      : 'Clique ao lado para permitir alertas no celular ou navegador.'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isDeviceConnected && (
                  <button
                    type="button"
                    disabled={isActivatingPush}
                    onClick={handleActivatePushOnDevice}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs transition-all disabled:opacity-50"
                  >
                    {isActivatingPush ? 'Ativando...' : 'Ativar Push'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={isTestingPush}
                  onClick={handleTestPush}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 transition-all disabled:opacity-50"
                  title="Enviar uma notificação Push de teste para seu aparelho agora"
                >
                  <Send size={11} />
                  <span>{isTestingPush ? 'Enviando...' : 'Testar Push'}</span>
                </button>
              </div>
            </div>

            {/* FILTROS E MARCAR LIDAS */}
            <div className="flex items-center justify-between gap-2 mt-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterTab('todas')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filterTab === 'todas'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todas ({notificacoes.length})
                </button>
                {isAdminOrFinance && viewMode === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setFilterTab('enviadas')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      filterTab === 'enviadas'
                        ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Enviadas aos Colaboradores
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <CheckCheck size={13} />
                    <span>Marcar lidas</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fetchNotifications(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Atualizar lista"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* LISTA DE NOTIFICAÇÕES */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 my-2 pr-1 min-h-[220px]">
              {filteredList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                  <Bell size={28} className="mx-auto opacity-30" />
                  <p>Nenhuma notificação push registrada até o momento.</p>
                </div>
              ) : (
                filteredList.map((item) => {
                  const dateFormatted = new Date(item.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleClickNotification(item)}
                      className="py-3 px-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </span>
                          {item.codigoOperacao && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.codigoOperacao}
                            </span>
                          )}
                          {isAdminOrFinance && viewMode === 'admin' && (
                            <span
                              className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                item.recipientRole === 'admin'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300'
                              }`}
                            >
                              {item.recipientRole === 'admin'
                                ? 'Alerta Admin'
                                : `Para: ${item.targetColaboradorNome?.split(' ')[0] || 'Colaborador'}`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.message}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                          <span>{dateFormatted}</span>
                          {typeof item.devicesReached === 'number' && item.devicesReached > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <Smartphone size={10} />
                              Push entregue ({item.devicesReached} disp.)
                            </span>
                          )}
                          {item.sentByNome && (
                            <span>Por: {item.sentByNome.split(' ')[0]}</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink
                        size={14}
                        className="text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 mt-1 transition-colors"
                      />
                    </div>
                  )
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MODAL DE ENVIO / REENVIO DE NOTIFICAÇÃO PUSH INDIVIDUAL PARA UMA OPERAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

interface CredImpactoManualPushModalProps {
  loan: CredImpactoEmprestimo | null
  onClose: () => void
}

const PUSH_TEMPLATE_OPTIONS: Array<{
  id: CredImpactoPushEventType
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badgeColor: string
}> = [
  {
    id: 'aprovado_aguardando_assinatura',
    label: 'Aprovado (Assinar)',
    icon: FileText,
    badgeColor: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    id: 'aprovado_aguardando_liberacao',
    label: 'Aprovado (Fila PIX)',
    icon: CheckCircle2,
    badgeColor: 'text-teal-600 dark:text-teal-400'
  },
  {
    id: 'recursos_liberados',
    label: 'PIX Depositado / Ativo',
    icon: Banknote,
    badgeColor: 'text-cyan-600 dark:text-cyan-400'
  },
  {
    id: 'contraproposta_enviada',
    label: 'Contraproposta',
    icon: Sparkles,
    badgeColor: 'text-purple-600 dark:text-purple-400'
  },
  {
    id: 'em_analise',
    label: 'Em Análise',
    icon: Clock,
    badgeColor: 'text-amber-600 dark:text-amber-400'
  },
  {
    id: 'lembrete_parcela',
    label: 'Lembrete Parcela',
    icon: BellRing,
    badgeColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'parcela_conciliada',
    label: 'Parcela Quitada',
    icon: Check,
    badgeColor: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    id: 'quitacao_confirmada',
    label: '100% Quitado',
    icon: HandCoins,
    badgeColor: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    id: 'simulacao_realizada',
    label: 'Simulação',
    icon: Calculator,
    badgeColor: 'text-indigo-600 dark:text-indigo-400'
  },
  {
    id: 'recusado',
    label: 'Recusado',
    icon: AlertTriangle,
    badgeColor: 'text-rose-600 dark:text-rose-400'
  }
]

export function CredImpactoManualPushModal({ loan, onClose }: CredImpactoManualPushModalProps) {
  const [selectedEvent, setSelectedEvent] = useState<CredImpactoPushEventType>('aprovado_aguardando_assinatura')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetRole, setTargetRole] = useState<'colaborador' | 'ambos'>('colaborador')
  const [isSending, setIsSending] = useState(false)
  const [deviceStatus, setDeviceStatus] = useState<{
    hasActiveDevice: boolean
    deviceCount: number
    targetCount: number
  } | null>(null)
  const [loadingDevice, setLoadingDevice] = useState(false)

  useEffect(() => {
    if (!loan) return
    const defaultEvt = getDefaultEventTypeForLoanStatus(loan)
    setSelectedEvent(defaultEvt)
    const tpl = getClientPushTemplate(defaultEvt, loan)
    setTitle(tpl.title)
    setMessage(tpl.message)

    // Consulta dispositivos ativos do colaborador
    const checkColabDevices = async () => {
      setLoadingDevice(true)
      try {
        const res = await fetch(
          `/api/credimpacto/push?loanId=${encodeURIComponent(loan.id)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (data.colaboradorDeviceStatus) {
          setDeviceStatus(data.colaboradorDeviceStatus)
        }
      } catch {} finally {
        setLoadingDevice(false)
      }
    }
    checkColabDevices()
  }, [loan])

  if (!loan) return null

  const handleSelectTemplate = (evt: CredImpactoPushEventType) => {
    setSelectedEvent(evt)
    const tpl = getClientPushTemplate(evt, loan)
    setTitle(tpl.title)
    setMessage(tpl.message)
  }

  const handleSendPush = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Preencha o título e a mensagem da notificação Push.')
      return
    }

    setIsSending(true)
    try {
      const res = await fetch('/api/credimpacto/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'notificar_operacao',
          emprestimoId: loan.id,
          eventType: selectedEvent,
          targetRole,
          customTitle: title.trim(),
          customMessage: message.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar Push')

      toast.success(
        data.devicesReached > 0
          ? `Notificação Push enviada para ${loan.colaboradorNome} (${data.devicesReached} aparelho(s) alcançado(s))!`
          : `Notificação Push enviada para ${loan.colaboradorNome} (disponível no Painel e Banner em tempo real)!`
      )
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao disparar notificação Push')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-indigo-200/90 dark:border-indigo-800/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <BellRing size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Enviar Notificação Push ao Colaborador
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {loan.colaboradorNome} • Operação <span className="font-mono font-bold">{loan.codigoOperacao}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* STATUS DE CONEXÃO PUSH DO COLABORADOR */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Smartphone
              size={16}
              className={
                deviceStatus?.hasActiveDevice
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-500'
              }
            />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Status Push de {loan.colaboradorNome.split(' ')[0]}:
              </span>{' '}
              {loadingDevice ? (
                <span className="text-slate-400">Verificando aparelhos...</span>
              ) : deviceStatus?.hasActiveDevice ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {deviceStatus.deviceCount} aparelho(s) ativo(s) no OneSignal + Banner Web
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Receberá via Banner em Tempo Real e Central do Portal
                </span>
              )}
            </div>
          </div>
          <ShieldCheck size={16} className="text-indigo-500 shrink-0" />
        </div>

        {/* SELETOR DE MODELO POR STATUS */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Escolha o Modelo por Status / Etapa
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {PUSH_TEMPLATE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSelected = selectedEvent === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectTemplate(opt.id)}
                  className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all text-left ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={13} className={isSelected ? 'text-indigo-600 dark:text-indigo-400 shrink-0' : `${opt.badgeColor} shrink-0`} />
                  <span className="truncate">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* DESTINATÁRIO */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">Destinatário do Push:</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="pushTargetRole"
                checked={targetRole === 'colaborador'}
                onChange={() => setTargetRole('colaborador')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span>Colaborador</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="pushTargetRole"
                checked={targetRole === 'ambos'}
                onChange={() => setTargetRole('ambos')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span>Colaborador + Admins</span>
            </label>
          </div>
        </div>

        {/* TÍTULO E MENSAGEM EDITÁVEIS */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Título da Notificação Push
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Mensagem da Notificação Push
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSending || !title.trim() || !message.trim()}
            onClick={handleSendPush}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-sm shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Send size={14} />
            <span>{isSending ? 'Disparando Push...' : 'Disparar Notificação Push'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
