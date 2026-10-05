'use client'

import React, { useState, useEffect } from 'react'
import {
  HandCoins,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  Upload,
  AlertCircle
} from 'lucide-react'
import { CredImpactoEmprestimo } from '@/types/credimpacto'
import { formatBrl } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface QuitacaoAntecipadaModalProps {
  loan: CredImpactoEmprestimo | null
  onClose: () => void
  onSuccess: () => void
  isAdminOrFinance: boolean
}

export function QuitacaoAntecipadaModal({
  loan,
  onClose,
  onSuccess,
  isAdminOrFinance
}: QuitacaoAntecipadaModalProps) {
  const [loadingCalc, setLoadingCalc] = useState(true)
  const [calcData, setCalcData] = useState<{
    saldoDevedorPrincipal: number
    jurosFuturosDispensados: number
    totalSemDesconto: number
    valorParaQuitacao: number
    economiaColaborador: number
    parcelasRestantesCount: number
  } | null>(null)

  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'transferencia' | 'dinheiro'>('pix')
  const [comprovanteUrl, setComprovanteUrl] = useState('')
  const [observacao, setObservacao] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!loan) return
    const fetchCalc = async () => {
      setLoadingCalc(true)
      try {
        const res = await fetch('/api/credimpacto/quitacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emprestimoId: loan.id })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro no cálculo de quitação')
        setCalcData(data)
      } catch (err: any) {
        toast.error(err.message || 'Falha ao calcular quitação antecipada')
      } finally {
        setLoadingCalc(false)
      }
    }
    fetchCalc()
  }, [loan])

  if (!loan) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pasta', 'quitacoes')

      const res = await fetch('/api/credimpacto/comprovante', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')

      setComprovanteUrl(data.url)
      toast.success('Comprovante anexado!')
    } catch (err: any) {
      toast.error(err.message || 'Falha no upload do comprovante')
    } finally {
      setIsUploading(false)
    }
  }

  const handleConfirmPayoff = async () => {
    if (!calcData) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/credimpacto/quitacao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emprestimoId: loan.id,
          valorPago: calcData.valorParaQuitacao,
          metodoPagamento,
          comprovanteUrl,
          observacao
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar quitação')

      toast.success(`Empréstimo ${loan.codigoOperacao} 100% quitado com sucesso!`)
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao confirmar quitação')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HandCoins size={18} className="text-emerald-600 dark:text-emerald-400" />
            Simulação de Quitação Antecipada
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
        </div>

        {loadingCalc ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 animate-pulse">
            Calculando desconto proporcional dos juros futuros...
          </div>
        ) : !calcData ? (
          <div className="py-8 text-center text-xs text-rose-600 dark:text-rose-400">
            Não foi possível calcular a quitação antecipada.
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Ao quitar antecipadamente, <strong>todos os juros das {calcData.parcelasRestantesCount} parcelas futuras são totalmente dispensados</strong>. Você paga exclusivamente o saldo devedor de principal remanescente:
            </p>

            {/* COMPARATIVO DE ECONOMIA */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Restante Agendado:</span>
                <span className="font-mono line-through">{formatBrl(calcData.totalSemDesconto)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1">
                  <Sparkles size={14} className="text-amber-500" />
                  Economia em Juros Futuros:
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400">-{formatBrl(calcData.economiaColaborador)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-emerald-200 dark:border-emerald-500/20 text-sm font-black">
                <span className="text-slate-900 dark:text-white">Valor Líquido para Quitação:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">{formatBrl(calcData.valorParaQuitacao)}</span>
              </div>
            </div>

            {isAdminOrFinance ? (
              <div className="space-y-3 text-xs">
                <div className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  Confirmar Recebimento pelo Setor Financeiro
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-700 dark:text-slate-400 mb-1">Forma de Pagamento</label>
                    <select
                      value={metodoPagamento}
                      onChange={(e: any) => setMetodoPagamento(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="pix">PIX</option>
                      <option value="transferencia">Transferência Bancária</option>
                      <option value="dinheiro">Dinheiro em Espécie</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-700 dark:text-slate-400 mb-1">Comprovante</label>
                    <label className="cursor-pointer flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-[11px] transition-all">
                      <Upload size={12} />
                      <span>{isUploading ? 'Enviando...' : 'Anexar'}</span>
                      <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {comprovanteUrl && (
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} /> Comprovante anexado
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-slate-700 dark:text-slate-400 mb-1">Observações</label>
                  <input
                    type="text"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Identificador da transação ou recibo..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">Instruções para Quitação pelo Colaborador:</div>
                <p className="leading-relaxed">
                  Para efetivar a quitação antecipada, realize o PIX no valor de <strong>{formatBrl(calcData.valorParaQuitacao)}</strong> para a chave da escola ou contate o financeiro. Após o envio do comprovante, o mútuo é baixado imediatamente e as parcelas futuras na folha são canceladas.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Voltar
              </button>
              {isAdminOrFinance && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmPayoff}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Processando...' : 'Confirmar Liquidação'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
