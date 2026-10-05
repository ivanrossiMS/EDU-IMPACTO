'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { CredImpactoHeader } from '@/components/credimpacto/CredImpactoHeader'
import { CredImpactoSidebar, CredImpactoBottomBar, TabId } from '@/components/credimpacto/CredImpactoNavigation'
import { ColaboradorDashboard } from '@/components/credimpacto/ColaboradorDashboard'
import { AdminDashboard } from '@/components/credimpacto/AdminDashboard'
import { SimuladorEmprestimo } from '@/components/credimpacto/SimuladorEmprestimo'
import { ConciliacaoFolhaTab } from '@/components/credimpacto/ConciliacaoFolhaTab'
import { ParcelasTab } from '@/components/credimpacto/ParcelasTab'
import { RelatoriosTab } from '@/components/credimpacto/RelatoriosTab'
import { RescisaoDesligamentoTab } from '@/components/credimpacto/RescisaoDesligamentoTab'
import { ConfiguracoesTab } from '@/components/credimpacto/ConfiguracoesTab'
import { AuditoriaTab } from '@/components/credimpacto/AuditoriaTab'
import { EmprestimoDetalhesModal } from '@/components/credimpacto/EmprestimoDetalhesModal'
import { AssinaturaEletronicaModal } from '@/components/credimpacto/AssinaturaEletronicaModal'
import { QuitacaoAntecipadaModal } from '@/components/credimpacto/QuitacaoAntecipadaModal'
import { CredImpactoConfig, CredImpactoEmprestimo } from '@/types/credimpacto'
import { DEFAULT_TERMO_AUTORIZACAO } from '@/lib/credimpacto/contractTemplate'
import { isCredImpactoAdmin } from '@/lib/credimpacto/authHelper'
import { toast } from 'sonner'
import { Landmark } from 'lucide-react'

export default function CredImpactoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando CredImpacto...</div>}>
      <CredImpactoContent />
    </Suspense>
  )
}

function CredImpactoContent() {
  const { currentUser } = useApp()
  const { perfis } = useData()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabId | null

  // Verificação de bloqueio no perfil
  const userPerfilObj = (perfis || []).find((p: any) => p.nome === currentUser?.perfil || p.nome === currentUser?.cargo)
  const isBlocked = userPerfilObj?.bloqueadoCredImpacto === true

  // Identificação do Perfil e Privilégios: SOMENTE Admin e Diretor Geral têm acesso à Gestão
  const isAdminOrFinance = isCredImpactoAdmin(currentUser?.perfil, currentUser?.cargo)

  // Estado da Visão: apenas admin/diretor geral pode acessar 'admin'; todos os demais acessam 'colaborador'
  const [viewMode, setViewMode] = useState<'admin' | 'colaborador'>(isAdminOrFinance ? 'admin' : 'colaborador')
  const [activeTab, setActiveTab] = useState<TabId>(isAdminOrFinance ? 'dashboard' : 'meus_emprestimos')

  // Sincroniza viewMode e activeTab iniciais conforme privilégio
  useEffect(() => {
    if (isAdminOrFinance) {
      setViewMode('admin')
      const adminAllowedTabs: TabId[] = [
        'dashboard',
        'analise',
        'liberacoes',
        'parcelas',
        'folha',
        'rescisao',
        'simular',
        'relatorios',
        'configuracoes',
        'auditoria'
      ]
      if (tabParam && adminAllowedTabs.includes(tabParam as TabId)) {
        setActiveTab(tabParam as TabId)
      } else {
        setActiveTab('dashboard')
      }
    } else {
      setViewMode('colaborador')
      // Se não for admin/diretor geral, restringe estritamente às abas do colaborador
      const colabTabs: TabId[] = ['meus_emprestimos', 'simular']
      if (tabParam && colabTabs.includes(tabParam as TabId)) {
        setActiveTab(tabParam as TabId)
      } else {
        setActiveTab('meus_emprestimos')
      }
    }
  }, [isAdminOrFinance, tabParam])

  // Dados do Módulo
  const [config, setConfig] = useState<CredImpactoConfig>({
    taxaMensalPadrao: 1.5,
    metodoCalculoPadrao: 'JUROS_SIMPLES_SALDO',
    metodosPermitidos: [
      'JUROS_SIMPLES_SALDO',
      'JUROS_SIMPLES_INICIAL',
      'ACRESCIMO_UNICO',
      'TABELA_PRICE',
      'BALAO_FINAL_COMPOSTO'
    ],
    prazoMinimoParcelas: 1,
    prazoMaximoParcelas: 24,
    valorMinimoEmprestimo: 200,
    valorMaximoEmprestimo: 25000,
    diaPadraoDescontoFolha: 5,
    exigeAprovacaoDupla: false,
    limiteCompensacaoRescisaoCltPercentual: 100,
    termoAutorizacaoDesconto: DEFAULT_TERMO_AUTORIZACAO
  })

  const [emprestimos, setEmprestimos] = useState<CredImpactoEmprestimo[]>([])
  const [colaboradoresList, setColaboradoresList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Modais
  const [selectedLoanForDetails, setSelectedLoanForDetails] = useState<CredImpactoEmprestimo | null>(null)
  const [selectedLoanForSign, setSelectedLoanForSign] = useState<CredImpactoEmprestimo | null>(null)
  const [selectedLoanForPayoff, setSelectedLoanForPayoff] = useState<CredImpactoEmprestimo | null>(null)

  // Perfil enriquecido do usuário logado (com CPF e Unidade)
  const [currentMe, setCurrentMe] = useState<{
    id: string
    nome: string
    email: string
    cpf?: string
    cargo?: string
    perfil?: string
    salarioBase?: number
    unidade?: string
    isAdminOrFinance: boolean
  } | null>(null)

  // Carga de Dados Inicial
  const loadData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const [cfgRes, empRes, meRes] = await Promise.all([
        fetch('/api/credimpacto/configuracao'),
        fetch('/api/credimpacto/emprestimos'),
        fetch('/api/credimpacto/me')
      ])

      if (cfgRes.ok) {
        const cfgData = await cfgRes.json()
        setConfig(cfgData)
      }

      if (empRes.ok) {
        const empData = await empRes.json()
        setEmprestimos(empData)
      }

      if (meRes.ok) {
        const meData = await meRes.json()
        setCurrentMe(meData)
      }

      // Se for admin, carrega lista de funcionários para dropdowns de concessão
      if (isAdminOrFinance) {
        try {
          const funcRes = await fetch('/api/rh/funcionarios?lightweight=true')
          if (funcRes.ok) {
            const funcs = await funcRes.json()
            setColaboradoresList(funcs)
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error('[CredImpacto loadData error]', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [isAdminOrFinance])

  useEffect(() => {
    loadData()
  }, [loadData])

  const pendingRequestsCount = emprestimos.filter(
    (e) => e.status === 'solicitado' || e.status === 'em_analise'
  ).length

  const pendingDisbursementCount = emprestimos.filter(
    (e) => e.status === 'aguardando_liberacao'
  ).length

  const totalEmprestadoAtivo = emprestimos
    .filter((e) => ['ativo', 'aguardando_liberacao', 'aguardando_assinatura'].includes(e.status))
    .reduce((acc, e) => acc + (e.valorAprovado || 0), 0)

  const saldoDevedorTotal = emprestimos
    .filter((e) => ['ativo', 'aguardando_liberacao', 'aguardando_assinatura'].includes(e.status))
    .reduce((acc, e) => acc + (e.saldoDevedorAtual || 0), 0)

  const handleToggleViewMode = (mode: 'admin' | 'colaborador') => {
    if (mode === 'admin' && !isAdminOrFinance) {
      toast.error('Acesso ao Painel Gestão restrito ao Administrador e Diretor Geral.')
      return
    }
    setViewMode(mode)
    if (mode === 'admin') {
      setActiveTab('dashboard')
    } else {
      setActiveTab('meus_emprestimos')
    }
  }

  const handleTabChange = (tab: TabId) => {
    const colabTabs: TabId[] = ['meus_emprestimos', 'simular']
    if (!colabTabs.includes(tab) && (!isAdminOrFinance || viewMode !== 'admin')) {
      toast.error('Acesso restrito ao Administrador e Diretor Geral.')
      setActiveTab('meus_emprestimos')
      return
    }
    // Administrador não tem Meu Espaço
    if (isAdminOrFinance && tab === 'meus_emprestimos') {
      setActiveTab('dashboard')
      return
    }
    setActiveTab(tab)
  }

  const handleOpenNewLoan = () => {
    setActiveTab('simular')
  }

  if (isBlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 text-2xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Módulo Não Habilitado</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            O módulo <strong>CredImpacto</strong> está desativado para o seu perfil ({currentUser?.perfil || 'Usuário'}). Solicite a liberação de acesso à Direção Geral em Configurações &gt; Usuários &gt; Perfis.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* SIDEBAR DEDICADA DO CREDIMPACTO (DESKTOP - STANDALONE EDGE-TO-EDGE) */}
      <CredImpactoSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        isAdminOrFinance={isAdminOrFinance}
        pendingRequestsCount={pendingRequestsCount}
        pendingDisbursementCount={pendingDisbursementCount}
        onNewLoanClick={handleOpenNewLoan}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        totalAtivo={totalEmprestadoAtivo}
        saldoDevedor={saldoDevedorTotal}
        currentMe={currentMe}
      />

      {/* ÁREA DE CONTEÚDO PRINCIPAL (COM SCROLL INDEPENDENTE) */}
      <div className="flex-1 min-w-0 h-screen overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-28 md:pb-12">
          {/* CABEÇALHO SUPERIOR */}
          <CredImpactoHeader
            isAdminOrFinance={isAdminOrFinance}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewMode}
            onNewLoanClick={handleOpenNewLoan}
            onRefresh={loadData}
            isRefreshing={isRefreshing}
            activeTab={activeTab}
            currentMe={currentMe}
          />

          {/* CONTEÚDO PRINCIPAL DE CADA ABA */}
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto animate-pulse">
                <Landmark size={24} className="text-emerald-400" />
              </div>
              <div className="text-sm font-semibold">Carregando módulo CredImpacto...</div>
            </div>
          ) : (
            <main>
              {/* VISÃO GERAL (ADMIN) */}
              {activeTab === 'dashboard' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="dashboard"
                  emprestimos={emprestimos}
                  onOpenDetails={setSelectedLoanForDetails}
                  onRefresh={loadData}
                />
              )}

              {/* TODAS AS OPERAÇÕES (ADMIN) */}
              {activeTab === 'emprestimos' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="emprestimos"
                  emprestimos={emprestimos}
                  onOpenDetails={setSelectedLoanForDetails}
                  onRefresh={loadData}
                />
              )}

              {/* FILA DE APROVAÇÃO (ADMIN) */}
              {activeTab === 'analise' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="analise"
                  emprestimos={emprestimos}
                  onOpenDetails={setSelectedLoanForDetails}
                  onRefresh={loadData}
                />
              )}

              {/* LIBERAÇÕES TED / TESOURARIA (ADMIN) */}
              {activeTab === 'liberacoes' && viewMode === 'admin' && (
                <AdminDashboard
                  viewModeTab="liberacoes"
                  emprestimos={emprestimos}
                  onOpenDetails={setSelectedLoanForDetails}
                  onRefresh={loadData}
                />
              )}

              {/* CONTROLE DE PARCELAS (ADMIN) */}
              {activeTab === 'parcelas' && viewMode === 'admin' && (
                <ParcelasTab
                  emprestimos={emprestimos}
                  onOpenDetails={setSelectedLoanForDetails}
                  onRefresh={loadData}
                />
              )}

              {/* CONCILIAÇÃO EM FOLHA (ADMIN) */}
              {activeTab === 'folha' && viewMode === 'admin' && (
                <ConciliacaoFolhaTab onRefresh={loadData} />
              )}

              {/* RESCISÃO E DESLIGAMENTO CLT (ADMIN) */}
              {activeTab === 'rescisao' && viewMode === 'admin' && (
                <RescisaoDesligamentoTab
                  emprestimos={emprestimos}
                  config={config}
                  onRefresh={loadData}
                />
              )}

              {/* CONCEDER EMPRÉSTIMO / SIMULADOR */}
              {activeTab === 'simular' && (
                <SimuladorEmprestimo
                  config={config}
                  userSalary={
                    currentMe?.salarioBase ||
                    ((currentUser as any)?.salario || currentUser?.user_metadata?.salario
                      ? Number((currentUser as any)?.salario || currentUser?.user_metadata?.salario)
                      : undefined)
                  }
                  isAdminOrFinance={isAdminOrFinance}
                  viewMode={viewMode}
                  currentUserId={currentMe?.id || currentUser?.id}
                  currentUserName={currentMe?.nome || currentUser?.nome || currentUser?.email}
                  currentUserCargo={currentMe?.cargo || currentUser?.cargo}
                  currentUserCpf={currentMe?.cpf || (currentUser as any)?.cpf}
                  currentUserUnidade={currentMe?.unidade}
                  colaboradoresList={colaboradoresList}
                  onRequestSubmitted={() => {
                    loadData()
                    setActiveTab(viewMode === 'admin' ? 'dashboard' : 'meus_emprestimos')
                  }}
                />
              )}

              {/* RELATÓRIOS & DRE (ADMIN) */}
              {activeTab === 'relatorios' && viewMode === 'admin' && (
                <RelatoriosTab
                  emprestimos={emprestimos}
                  onOpenDetails={setSelectedLoanForDetails}
                />
              )}

              {/* PARÂMETROS E POLÍTICAS (ADMIN) */}
              {activeTab === 'configuracoes' && viewMode === 'admin' && (
                <ConfiguracoesTab
                  initialConfig={config}
                  onConfigSaved={(newCfg) => setConfig(newCfg)}
                />
              )}

              {/* AUDITORIA (ADMIN) */}
              {activeTab === 'auditoria' && viewMode === 'admin' && (
                <AuditoriaTab />
              )}

              {/* MEUS EMPRÉSTIMOS (COLABORADOR) */}
              {activeTab === 'meus_emprestimos' && (
                <ColaboradorDashboard
                  emprestimos={emprestimos}
                  onOpenDetails={setSelectedLoanForDetails}
                  onOpenSignModal={setSelectedLoanForSign}
                  onOpenPayoffModal={setSelectedLoanForPayoff}
                  onRefresh={loadData}
                />
              )}
            </main>
          )}
        </div>
      </div>

      {/* RODAPÉ ULTRA MODERNO (DOCK MOBILE) */}
      <CredImpactoBottomBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        isAdminOrFinance={isAdminOrFinance}
        pendingRequestsCount={pendingRequestsCount}
        pendingDisbursementCount={pendingDisbursementCount}
        onNewLoanClick={handleOpenNewLoan}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        totalAtivo={totalEmprestadoAtivo}
        saldoDevedor={saldoDevedorTotal}
        currentMe={currentMe}
      />

      {/* MODAL DE DETALHES COMPLETOS & PARCELAS */}
      <EmprestimoDetalhesModal
        loan={selectedLoanForDetails}
        onClose={() => setSelectedLoanForDetails(null)}
        onOpenSignModal={(l) => {
          setSelectedLoanForDetails(null)
          setSelectedLoanForSign(l)
        }}
        onOpenPayoffModal={(l) => {
          setSelectedLoanForDetails(null)
          setSelectedLoanForPayoff(l)
        }}
        onDelete={async (l) => {
          if (!confirm(`Deseja realmente excluir permanentemente a operação ${l.codigoOperacao} de ${l.colaboradorNome}? Esta ação é irreversível.`)) return
          try {
            const res = await fetch(`/api/credimpacto/emprestimos?id=${l.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
            toast.success(`Empréstimo ${l.codigoOperacao} excluído com sucesso!`)
            setSelectedLoanForDetails(null)
            loadData()
          } catch (e: any) {
            toast.error(e.message || 'Falha ao excluir operação.')
          }
        }}
        isAdminOrFinance={isAdminOrFinance}
      />

      {/* MODAL DE ASSINATURA ELETRÔNICA */}
      <AssinaturaEletronicaModal
        loan={selectedLoanForSign}
        onClose={() => setSelectedLoanForSign(null)}
        onSignatureSuccess={() => {
          loadData()
        }}
      />

      {/* MODAL DE QUITAÇÃO ANTECIPADA */}
      <QuitacaoAntecipadaModal
        loan={selectedLoanForPayoff}
        onClose={() => setSelectedLoanForPayoff(null)}
        onSuccess={() => {
          loadData()
        }}
        isAdminOrFinance={isAdminOrFinance}
      />
    </div>
  )
}
