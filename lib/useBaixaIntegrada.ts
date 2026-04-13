/**
 * useBaixaIntegrada.ts — Gateway centralizado de baixas financeiras
 *
 * Qualquer pagamento do sistema (aluno, lote, responsável, contas a pagar)
 * deve passar por este hook para garantir:
 *  1. Geração automática de recibo digital com token/hash
 *  2. Espelho como MovCaixaItem no caixa selecionado (extrato do caixa)
 *  3. Anti-duplicidade por referenciaId
 *  4. Plano de contas e centro de custo propagados corretamente
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export interface BaixaPayload {
  referenciaId: string   // ID Da Parcela (UUID do título)
  caixaId: string
  valor: number
  descricao: string
  dataPagto: string
  formasPagto: string
  planoContasId?: string
  nomeAluno?: string
  operador?: string
  // ─── Campos de enriquecimento do recibo (opcionais) ───────────────
  alunoId?: string
  alunoNome?: string
  alunoTurma?: string
  responsavelNome?: string
  payerDocument?: string
  unidadeNome?: string
  eventDescription?: string
}

export function useBaixaIntegrada() {
  const queryClient = useQueryClient()

  const registrarBaixa = useCallback(async (payload: BaixaPayload): Promise<boolean> => {
    if (!payload.caixaId) {
      console.warn(`[useBaixaIntegrada] caixaId bloqueado`)
      return false
    }

    try {
      const response = await fetch('/api/financeiro/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcela_id: payload.referenciaId,
          caixa_id: payload.caixaId,
          valor_recebido: payload.valor,
          operador: payload.operador || payload.nomeAluno || 'Sistema',
          forma_pagamento: payload.formasPagto,
          plano_contas_id: payload.planoContasId || null,
          descricao: payload.descricao,
          // Enriquecimento do recibo
          aluno_id: payload.alunoId || '',
          aluno_nome: payload.alunoNome || payload.nomeAluno || '',
          aluno_turma: payload.alunoTurma || '',
          responsavel_nome: payload.responsavelNome || '',
          payer_document: payload.payerDocument || '',
          unidade_nome: payload.unidadeNome || '',
          event_description: payload.eventDescription || payload.descricao || '',
        })
      })

      if (!response.ok) {
        const err = await response.json()
        console.error("Transação Recusada pelo Banco:", err.error)
        alert(`Transação Recusada: ${err.error}`)
        return false
      }

      // Sucesso! Invalida cache de caixas para o Frontend piscar atualizado
      await queryClient.invalidateQueries({ queryKey: ['caixas-pdv'] })
      return true
    } catch (e: any) {
      console.error("Erro fatal disparando transação:", e.message)
      return false
    }
  }, [queryClient])

  const estornarBaixa = useCallback(async (referenciaId: string): Promise<void> => {
    alert("Para estornar uma baixa agora, utilize explicitamente o botão de Estorno no Histórico Financeiro.")
    // Na Fase C ou seguinte, implementaremos o estorno RLS. O banco agora protege exclusões arbitrárias!
  }, [])

  const registrarBaixasEmLote = useCallback(async (payloads: BaixaPayload[]): Promise<number> => {
    let successCount = 0
    // Executa as transações em lote
    for (const p of payloads) {
      const res = await registrarBaixa(p)
      if (res) successCount++
    }
    return successCount
  }, [registrarBaixa])

  return { registrarBaixa, estornarBaixa, registrarBaixasEmLote }
}
