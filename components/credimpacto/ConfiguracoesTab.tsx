'use client'

import React, { useState } from 'react'
import {
  Settings,
  ShieldCheck,
  Save,
  HelpCircle,
  Percent,
  CheckSquare,
  AlertTriangle,
  FileSignature,
  RotateCcw,
  Info
} from 'lucide-react'
import { CredImpactoConfig, MetodoCalculo } from '@/types/credimpacto'
import { METODOS_LABELS } from '@/lib/credimpacto/engine'
import { DEFAULT_TERMO_AUTORIZACAO } from '@/lib/credimpacto/contractTemplate'
import { toast } from 'sonner'

interface ConfiguracoesTabProps {
  initialConfig: CredImpactoConfig
  onConfigSaved: (config: CredImpactoConfig) => void
}

const ALL_METODOS: MetodoCalculo[] = [
  'JUROS_SIMPLES_SALDO',
  'JUROS_SIMPLES_INICIAL',
  'ACRESCIMO_UNICO',
  'TABELA_PRICE',
  'BALAO_FINAL_COMPOSTO'
]

export function ConfiguracoesTab({ initialConfig, onConfigSaved }: ConfiguracoesTabProps) {
  const [config, setConfig] = useState<CredImpactoConfig>({
    ...initialConfig,
    termoAutorizacaoDesconto: initialConfig.termoAutorizacaoDesconto ?? DEFAULT_TERMO_AUTORIZACAO
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleResetTermo = () => {
    setConfig((prev) => ({
      ...prev,
      termoAutorizacaoDesconto: DEFAULT_TERMO_AUTORIZACAO
    }))
    toast.info('Texto da autorização restaurado para a redação legal padrão.')
  }

  const handleToggleMetodo = (m: MetodoCalculo) => {
    const current = config.metodosPermitidos || []
    if (current.includes(m)) {
      if (current.length === 1) {
        toast.error('Pelo menos um método de cálculo deve permanecer ativo.')
        return
      }
      const updated = current.filter((item) => item !== m)
      setConfig({
        ...config,
        metodosPermitidos: updated,
        metodoCalculoPadrao: config.metodoCalculoPadrao === m ? updated[0] : config.metodoCalculoPadrao
      })
    } else {
      setConfig({
        ...config,
        metodosPermitidos: [...current, m]
      })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/credimpacto/configuracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar configurações')

      toast.success('Políticas e parâmetros de crédito salvos com sucesso!')
      onConfigSaved(data)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3.5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Políticas de Crédito e Parâmetros Contábeis
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            Configure as condições de empréstimo validadas pela assessoria jurídica e contabilidade escolar. Alterações de taxa ou método serão aplicadas estritamente a novos contratos, preservando 100% da imutabilidade dos contratos já assinados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: TAXA E MÉTODOS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Percent size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Taxa e Método de Juros</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Taxa de Juros Mensal Padrão (% a.m.)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              value={config.taxaMensalPadrao}
              onChange={(e) => setConfig({ ...config, taxaMensalPadrao: Number(e.target.value) })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Taxa aplicada por padrão nas simulações e novas propostas aos colaboradores.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Método de Cálculo Padrão
            </label>
            <select
              value={config.metodoCalculoPadrao}
              onChange={(e: any) => setConfig({ ...config, metodoCalculoPadrao: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {(config.metodosPermitidos || []).map((m) => (
                <option key={m} value={m}>
                  {METODOS_LABELS[m]?.nome || m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Métodos Permitidos para Concessão:
            </label>
            <div className="space-y-2">
              {ALL_METODOS.map((m) => {
                const isChecked = (config.metodosPermitidos || []).includes(m)
                const info = METODOS_LABELS[m]

                return (
                  <label
                    key={m}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleMetodo(m)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-200">{info?.nome}</div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">{info?.descricao}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* CARD 2: LIMITES OPERACIONAIS E PRAZOS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Settings size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span>Limites Operacionais e Prazos</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Mínimo (R$)</label>
              <input
                type="number"
                step="50"
                value={config.valorMinimoEmprestimo}
                onChange={(e) => setConfig({ ...config, valorMinimoEmprestimo: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Máximo (R$)</label>
              <input
                type="number"
                step="500"
                value={config.valorMaximoEmprestimo}
                onChange={(e) => setConfig({ ...config, valorMaximoEmprestimo: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Prazo Mínimo (Parcelas)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.prazoMinimoParcelas}
                onChange={(e) => setConfig({ ...config, prazoMinimoParcelas: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Prazo Máximo (Parcelas)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.prazoMaximoParcelas}
                onChange={(e) => setConfig({ ...config, prazoMaximoParcelas: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Dia de Vencimento do Desconto em Folha
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={config.diaPadraoDescontoFolha}
              onChange={(e) => setConfig({ ...config, diaPadraoDescontoFolha: Number(e.target.value) })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Dia padrão do mês de pagamento do salário (geralmente 5º dia útil ou dia 5).
            </p>
          </div>
        </div>

        {/* CARD 3: TERMO DE AUTORIZAÇÃO DE DESCONTO EM FOLHA */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSignature size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                  Termo de Autorização de Desconto em Folha (CLT Art. 462)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                  Validade Jurídica
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Redação formal de consentimento prévio e expresso que o colaborador assina digitalmente. Este texto é incorporado na Cláusula Terceira do contrato de mútuo.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetTermo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all shrink-0 active:scale-98"
            >
              <RotateCcw size={13} />
              <span>Restaurar Padrão Legal</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Texto da Autorização de Desconto (Exibido na Assinatura e no Contrato)
            </label>
            <textarea
              rows={4}
              value={config.termoAutorizacaoDesconto ?? DEFAULT_TERMO_AUTORIZACAO}
              onChange={(e) => setConfig({ ...config, termoAutorizacaoDesconto: e.target.value })}
              placeholder="Digite o texto da autorização de desconto em folha..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              <span>Fundamentação jurídica: <strong>Artigo 462 da CLT</strong> e <strong>Súmula nº 342 do TST</strong>.</span>
              <span className="font-mono">{(config.termoAutorizacaoDesconto ?? DEFAULT_TERMO_AUTORIZACAO).length} caracteres</span>
            </div>
          </div>

          <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3.5 flex items-start gap-3">
            <Info size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-indigo-950 dark:text-indigo-200 leading-relaxed">
              <strong className="font-semibold block mb-0.5 text-indigo-900 dark:text-indigo-100">
                Onde este termo é aplicado automaticamente pelo CredImpacto:
              </strong>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-indigo-800/90 dark:text-indigo-300">
                <li><strong>Na Assinatura Eletrônica:</strong> O colaborador deve assinalar o consentimento deste texto antes de submeter a assinatura digital não-repudiável (com IP e carimbo de data/hora).</li>
                <li><strong>No Contrato Formal (Cláusula 3ª):</strong> Inscrito na íntegra no Instrumento Particular de Mútuo em PDF/HTML.</li>
                <li><strong>Na Auditoria Jurídica:</strong> Arquivado de forma imutável com a versão exata pactuada no momento da emissão da operação.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all active:scale-98 disabled:opacity-50"
        >
          <Save size={16} />
          <span>{isSaving ? 'Salvando Parâmetros...' : 'Salvar Configurações'}</span>
        </button>
      </div>
    </form>
  )
}
