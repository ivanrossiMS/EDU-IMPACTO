'use client'

import React, { useState } from 'react'
import {
  FileCheck2,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Download,
  Fingerprint,
  UserCheck
} from 'lucide-react'
import { CredImpactoEmprestimo } from '@/types/credimpacto'
import { formatBrl } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface AssinaturaEletronicaModalProps {
  loan: CredImpactoEmprestimo | null
  onClose: () => void
  onSignatureSuccess: () => void
}

export function AssinaturaEletronicaModal({
  loan,
  onClose,
  onSignatureSuccess
}: AssinaturaEletronicaModalProps) {
  const [cpf, setCpf] = useState(loan?.colaboradorCpf || '')
  const [senha, setSenha] = useState('')
  const [aceitoContrato, setAceitoContrato] = useState(false)
  const [aceitoDesconto, setAceitoDesconto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signatureReceipt, setSignatureReceipt] = useState<{
    codigoVerificacao: string
    hashSha256: string
    assinadoEm: string
  } | null>(null)

  const formatCpfMask = (val: string) => {
    const digits = (val || '').replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }

  // Sincroniza CPF inicial e reseta estados ao abrir um contrato
  React.useEffect(() => {
    if (loan) {
      const rawCpf = loan.colaboradorCpf || ''
      const clean = rawCpf.replace(/\D/g, '')
      if (clean === '00000000000' || clean.length !== 11) {
        setCpf('')
      } else {
        setCpf(formatCpfMask(rawCpf))
      }
      setSenha('')
      setAceitoContrato(false)
      setAceitoDesconto(false)
      setSignatureReceipt(null)
    }
  }, [loan])

  if (!loan) return null

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aceitoContrato || !aceitoDesconto) {
      toast.error('Você deve assinalar o aceite das condições e a autorização de desconto em folha.')
      return
    }

    const cleanCpfDigits = (cpf || '').replace(/\D/g, '')
    if (cleanCpfDigits.length !== 11 || cleanCpfDigits === '00000000000') {
      toast.error('Por favor, informe seu CPF completo (11 dígitos). Ele constará no contrato oficial de mútuo.')
      return
    }

    setIsSubmitting(true)
    try {
      const formattedCpf = formatCpfMask(cpf)
      const res = await fetch('/api/credimpacto/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emprestimoId: loan.id,
          cpf: formattedCpf,
          senha,
          termoAceito: true
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao validar assinatura')

      setSignatureReceipt({
        codigoVerificacao: data.codigoVerificacao,
        hashSha256: data.hashSha256,
        assinadoEm: data.assinadoEm
      })

      toast.success('Assinatura eletrônica autenticada e certificada com sucesso!')
      onSignatureSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao autenticar assinatura.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Fingerprint size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Assinatura Eletrônica Verificada
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Instrumento Jurídico de Mútuo • Operação {loan.codigoOperacao}
              </p>
            </div>
          </div>
          {!signatureReceipt && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
          )}
        </div>

        {/* TELA DE SUCESSO APÓS ASSINATURA */}
        {signatureReceipt ? (
          <div className="space-y-4 py-4 text-center animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Documento Assinado com Sucesso!</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
                Sua assinatura eletrônica e autorização de desconto em folha foram registradas com carimbo de tempo e hash criptográfico não-repudiável.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 text-left text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Código de Verificação:</span>
                <span className="text-cyan-700 dark:text-cyan-400 font-bold">{signatureReceipt.codigoVerificacao}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Data / Hora (UTC):</span>
                <span className="text-slate-700 dark:text-slate-300">{new Date(signatureReceipt.assinadoEm).toUTCString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-sans block mb-1">Hash SHA-256 de Autenticidade:</span>
                <code className="text-[10px] text-emerald-700 dark:text-emerald-400 break-all bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded block border border-emerald-200/60 dark:border-emerald-800/40">
                  {signatureReceipt.hashSha256}
                </code>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all"
            >
              Concluir e Retornar ao Painel
            </button>
          </div>
        ) : (
          <form onSubmit={handleSign} className="space-y-4">
            {/* DOCUMENTO PRÉ-VISUALIZAÇÃO */}
            <div className="bg-slate-50 dark:bg-white rounded-xl p-4 text-slate-900 border border-slate-200 dark:border-slate-300 text-xs max-h-56 overflow-y-auto font-sans leading-relaxed shadow-inner">
              <div
                dangerouslySetInnerHTML={{
                  __html: loan.contratoConteudoHtml || '<p>Carregando minuta contratual...</p>'
                }}
              />
            </div>

            {/* AVISO DE EVIDÊNCIAS COLETADAS */}
            <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 text-xs flex items-start gap-2.5 text-blue-900 dark:text-blue-300">
              <ShieldCheck size={18} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="text-[11px] leading-relaxed">
                Em conformidade com a MP 2.200-2/2001 e a Lei 14.063/2020, ao assinar serão registrados seu <strong>endereço IP</strong>, <strong>identificador de navegador/dispositivo</strong>, <strong>carimbo de data/hora oficial</strong> e <strong>hash criptográfico SHA-256</strong>.
              </div>
            </div>

            {/* CHECKBOXES DE CONSENTIMENTO LEGAL */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceitoContrato}
                  onChange={(e) => setAceitoContrato(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>
                  Declaro que li, compreendi e concordo integralmente com o valor concedido de <strong>{formatBrl(loan.valorAprovado)}</strong>, a taxa de <strong>{loan.taxaMensal}% a.m.</strong> e o cronograma de <strong>{loan.quantidadeParcelas} parcelas</strong>.
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceitoDesconto}
                  onChange={(e) => setAceitoDesconto(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <span className="leading-relaxed text-[11px]">
                  <strong>AUTORIZAÇÃO DE DESCONTO EM FOLHA:</strong>{' '}
                  {loan.termoAutorizacaoDesconto ||
                    'Com fulcro no artigo 462, caput, da Consolidação das Leis do Trabalho (CLT) e na Súmula nº 342 do Tribunal Superior do Trabalho (TST), de forma livre, espontânea, expressa e irrevogável, AUTORIZO a empregadora a efetuar o desconto mensal das parcelas discriminadas na folha de pagamento de meus salários e/ou remunerações.'}
                </span>
              </label>
            </div>

            {/* AVISO QUANDO CPF AINDA NÃO CONSTA OU ESTÁ PENDENTE */}
            {(!loan.colaboradorCpf || loan.colaboradorCpf.replace(/\D/g, '').length !== 11 || loan.colaboradorCpf.replace(/\D/g, '') === '00000000000') && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3.5 text-xs flex items-start gap-2.5 text-amber-900 dark:text-amber-200 animate-in fade-in">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Atenção:</strong> Seu CPF ainda não consta cadastrado nesta proposta de empréstimo. <strong>Preencha obrigatoriamente o seu CPF completo com 11 dígitos abaixo</strong> para validar a assinatura jurídica e formalizar o contrato de mútuo.
                </div>
              </div>
            )}

            {/* CPF OBRIGATÓRIO PARA ASSINATURA */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>CPF do Titular</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Obrigatório para emissão jurídica do contrato
                </span>
              </label>
              <input
                type="text"
                required
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Seu CPF constará no instrumento de mútuo e autorização de desconto, sendo também atualizado no seu cadastro funcional.
              </p>
            </div>

            {/* CONFIRMAÇÃO DE IDENTIDADE / SENHA */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={14} className="text-cyan-600 dark:text-cyan-400" />
                Confirme sua Senha de Acesso (Assinatura Eletrônica)
              </label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha do sistema Impacto EDU..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                A validação de senha garante a autenticidade jurídica da assinatura eletrônica.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !aceitoContrato || !aceitoDesconto || !senha || !cpf || cpf.replace(/\D/g, '').length !== 11 || cpf.replace(/\D/g, '') === '00000000000'}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm shadow-blue-600/20 flex items-center gap-2 disabled:opacity-40 transition-all active:scale-98"
              >
                {isSubmitting ? (
                  <span>Certificando assinatura...</span>
                ) : (
                  <>
                    <FileCheck2 size={15} />
                    <span>Assinar Eletronicamente e Autorizar Desconto</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
