// ==============================================================================
// Repositório de Banco de Dados Resiliente do CredImpacto
// Suporta tabelas relacionais dedicadas com fallback resiliente para zero downtime
// ==============================================================================

import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  CredImpactoConfig,
  CredImpactoEmprestimo,
  CredImpactoParcela,
  CredImpactoQuitacao,
  CredImpactoRescisao,
  CredImpactoAuditLog,
  StatusParcela
} from '@/types/credimpacto'
import { roundMoney } from './engine'
import { DEFAULT_TERMO_AUTORIZACAO } from './contractTemplate'

function isTableMissingError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  const code = err.code || ''
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('relation') ||
    msg.includes('schema cache')
  )
}

const DEFAULT_CONFIG: CredImpactoConfig = {
  taxaMensalPadrao: 1.5,
  metodoCalculoPadrao: 'JUROS_SIMPLES_SALDO',
  metodosPermitidos: [
    'JUROS_SIMPLES_SALDO',
    'JUROS_SIMPLES_INICIAL',
    'ACRESCIMO_UNICO',
    'TABELA_PRICE',
    'BALAO_FINAL_COMPOSTO'
  ],
  margemMaximaConsignavel: 30,
  prazoMinimoParcelas: 1,
  prazoMaximoParcelas: 24,
  valorMinimoEmprestimo: 200,
  valorMaximoEmprestimo: 25000,
  diaPadraoDescontoFolha: 5,
  exigeAprovacaoDupla: false,
  limiteCompensacaoRescisaoCltPercentual: 100,
  termoAutorizacaoDesconto: DEFAULT_TERMO_AUTORIZACAO
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFIGURAÇÕES GERAIS
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetConfiguracao(): Promise<CredImpactoConfig> {
  const sb = getAdminClient()

  // 1. Tenta tabela dedicada
  try {
    const { data, error } = await sb
      .from('credimpacto_configuracao')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()

    if (!error && data) {
      return {
        id: data.id,
        taxaMensalPadrao: Number(data.taxa_mensal_padrao ?? DEFAULT_CONFIG.taxaMensalPadrao),
        metodoCalculoPadrao: data.metodo_calculo_padrao || DEFAULT_CONFIG.metodoCalculoPadrao,
        metodosPermitidos: data.metodos_permitidos || DEFAULT_CONFIG.metodosPermitidos,
        margemMaximaConsignavel: Number(data.margem_maxima_consignavel ?? DEFAULT_CONFIG.margemMaximaConsignavel),
        prazoMinimoParcelas: Number(data.prazo_minimo_parcelas ?? DEFAULT_CONFIG.prazoMinimoParcelas),
        prazoMaximoParcelas: Number(data.prazo_maximo_parcelas ?? DEFAULT_CONFIG.prazoMaximoParcelas),
        valorMinimoEmprestimo: Number(data.valor_minimo_emprestimo ?? DEFAULT_CONFIG.valorMinimoEmprestimo),
        valorMaximoEmprestimo: Number(data.valor_maximo_emprestimo ?? DEFAULT_CONFIG.valorMaximoEmprestimo),
        diaPadraoDescontoFolha: Number(data.dia_padrao_desconto_folha ?? DEFAULT_CONFIG.diaPadraoDescontoFolha),
        exigeAprovacaoDupla: Boolean(data.exige_aprovacao_dupla),
        limiteCompensacaoRescisaoCltPercentual: Number(data.limite_compensacao_rescisao_clt_percentual ?? 100),
        textoContratoPadrao: data.texto_contrato_padrao,
        termoAutorizacaoDesconto: data.termo_autorizacao_desconto || DEFAULT_CONFIG.termoAutorizacaoDesconto,
        updatedAt: data.updated_at
      }
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetConfiguracao dedicated]', err)
  }

  // 2. Fallback na tabela geral 'configuracoes' (chave: 'credimpacto_config')
  try {
    const { data } = await sb
      .from('configuracoes')
      .select('valor, updated_at')
      .eq('chave', 'credimpacto_config')
      .maybeSingle()

    if (data && data.valor) {
      return {
        ...DEFAULT_CONFIG,
        ...(data.valor as any),
        updatedAt: data.updated_at
      }
    }
  } catch (err: any) {
    console.warn('[dbGetConfiguracao fallback error]', err?.message)
  }

  return DEFAULT_CONFIG
}

export async function dbSaveConfiguracao(
  config: Partial<CredImpactoConfig>,
  autor: { id: string; nome: string; perfil?: string }
): Promise<CredImpactoConfig> {
  const sb = getAdminClient()
  const previous = await dbGetConfiguracao()
  const merged: CredImpactoConfig = { ...previous, ...config, updatedAt: new Date().toISOString() }

  // 1. Tenta salvar na tabela dedicada
  let savedDedicated = false
  try {
    const row = {
      id: 'default',
      taxa_mensal_padrao: merged.taxaMensalPadrao,
      metodo_calculo_padrao: merged.metodoCalculoPadrao,
      metodos_permitidos: merged.metodosPermitidos,
      margem_maxima_consignavel: merged.margemMaximaConsignavel,
      prazo_minimo_parcelas: merged.prazoMinimoParcelas,
      prazo_maximo_parcelas: merged.prazoMaximoParcelas,
      valor_minimo_emprestimo: merged.valorMinimoEmprestimo,
      valor_maximo_emprestimo: merged.valorMaximoEmprestimo,
      dia_padrao_desconto_folha: merged.diaPadraoDescontoFolha,
      exige_aprovacao_dupla: merged.exigeAprovacaoDupla,
      limite_compensacao_rescisao_clt_percentual: merged.limiteCompensacaoRescisaoCltPercentual,
      texto_contrato_padrao: merged.textoContratoPadrao || null,
      termo_autorizacao_desconto: merged.termoAutorizacaoDesconto || DEFAULT_CONFIG.termoAutorizacaoDesconto,
      updated_at: new Date().toISOString()
    }

    const { error } = await sb.from('credimpacto_configuracao').upsert(row)
    if (!error) savedDedicated = true
  } catch (err) {
    // segue para fallback
  }

  // 2. Garante persistência também na tabela 'configuracoes'
  try {
    await sb.from('configuracoes').upsert({
      chave: 'credimpacto_config',
      valor: merged,
      updated_at: new Date().toISOString()
    })
  } catch (err) {
    console.warn('[dbSaveConfiguracao fallback error]', err)
  }

  // Registra log de auditoria
  await dbRegistrarAuditLog({
    id: crypto.randomUUID(),
    entidadeTipo: 'configuracao',
    entidadeId: 'default',
    acao: 'ALTERACAO_CONFIG',
    autorId: autor.id,
    autorNome: autor.nome,
    autorPerfil: autor.perfil,
    dadosAnteriores: previous,
    dadosNovos: merged,
    justificativa: 'Atualização de políticas e parâmetros de crédito',
    createdAt: new Date().toISOString()
  })

  return merged
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. OPERAÇÕES DE EMPRÉSTIMO
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetEmprestimos(filtros?: {
  colaboradorId?: string
  colaboradorIds?: string[]
  colaboradorEmail?: string
  colaboradorNome?: string
  status?: string
  competencia?: string
}): Promise<CredImpactoEmprestimo[]> {
  const sb = getAdminClient()

  const idList = Array.from(
    new Set([filtros?.colaboradorId, ...(filtros?.colaboradorIds || [])].filter(Boolean))
  ) as string[]
  const cleanEmail = (filtros?.colaboradorEmail || '').trim().toLowerCase()
  const cleanNome = (filtros?.colaboradorNome || '').trim().toLowerCase()

  // 1. Tenta tabela dedicada
  try {
    let query = sb
      .from('credimpacto_emprestimos')
      .select('*')
      .order('created_at', { ascending: false })

    if (idList.length === 1) {
      query = query.eq('colaborador_id', idList[0])
    } else if (idList.length > 1) {
      query = query.in('colaborador_id', idList)
    }
    if (filtros?.status && filtros.status !== 'todos') {
      query = query.eq('status', filtros.status)
    }

    const { data: emprestimos, error } = await query

    if (!error && Array.isArray(emprestimos)) {
      // Busca as parcelas para cada empréstimo
      const empIds = emprestimos.map((e) => e.id)
      let parcelasMap: Record<string, CredImpactoParcela[]> = {}

      if (empIds.length > 0) {
        const { data: parcs } = await sb
          .from('credimpacto_parcelas')
          .select('*')
          .in('emprestimo_id', empIds)
          .order('numero', { ascending: true })

        if (Array.isArray(parcs)) {
          parcs.forEach((p) => {
            const parsedParcela: CredImpactoParcela = {
              id: p.id,
              emprestimoId: p.emprestimo_id,
              numero: p.numero,
              competencia: p.competencia,
              dataVencimento: p.data_vencimento,
              valorAmortizacao: Number(p.valor_amortizacao),
              valorJuros: Number(p.valor_juros),
              valorTotal: Number(p.valor_total),
              saldoDevedorApos: Number(p.saldo_devedor_apos),
              status: p.status,
              dataPagamento: p.data_pagamento,
              valorPago: p.valor_pago ? Number(p.valor_pago) : undefined,
              metodoPagamento: p.metodo_pagamento,
              loteFolhaId: p.lote_folha_id,
              comprovanteUrl: p.comprovante_url,
              observacao: p.observacao,
              responsavelBaixaId: p.responsavel_baixa_id,
              responsavelBaixaNome: p.responsavel_baixa_nome,
              baixadoEm: p.baixado_em
            }
            if (!parcelasMap[p.emprestimo_id]) parcelasMap[p.emprestimo_id] = []
            parcelasMap[p.emprestimo_id].push(parsedParcela)
          })
        }
      }

      return emprestimos.map((e) => mapDbRowToEmprestimo(e, parcelasMap[e.id] || []))
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetEmprestimos dedicated error]', err)
  }

  // 2. Fallback resiliente usando relatorios_records com prefixo 'credimpacto:emp:'
  try {
    let query = sb
      .from('relatorios_records')
      .select('*')
      .like('id', 'credimpacto:emp:%')
      .order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    let list: CredImpactoEmprestimo[] = (data || []).map((row: any) => ({
      ...row.dados,
      id: row.id.replace('credimpacto:emp:', ''),
      createdAt: row.created_at,
      updatedAt: row.dados?.updatedAt || row.created_at
    }))

    const allowedIds = new Set(idList)
    if (allowedIds.size > 0 || cleanEmail || cleanNome) {
      list = list.filter((e) => {
        if (allowedIds.has(e.colaboradorId)) return true
        if (cleanEmail && e.colaboradorEmail && e.colaboradorEmail.trim().toLowerCase() === cleanEmail) return true
        if (cleanNome && e.colaboradorNome && e.colaboradorNome.trim().toLowerCase() === cleanNome) return true
        return false
      })
    }

    if (filtros?.status && filtros.status !== 'todos') {
      list = list.filter((e) => e.status === filtros.status)
    }

    return list
  } catch (err: any) {
    console.error('[dbGetEmprestimos fallback error]', err)
    return []
  }
}

export async function dbGetEmprestimoById(id: string): Promise<CredImpactoEmprestimo | null> {
  const sb = getAdminClient()

  // 1. Tenta tabela dedicada
  try {
    const { data: e, error } = await sb
      .from('credimpacto_emprestimos')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!error && e) {
      const { data: parcs } = await sb
        .from('credimpacto_parcelas')
        .select('*')
        .eq('emprestimo_id', id)
        .order('numero', { ascending: true })

      const parcelas: CredImpactoParcela[] = (parcs || []).map((p: any) => ({
        id: p.id,
        emprestimoId: p.emprestimo_id,
        numero: p.numero,
        competencia: p.competencia,
        dataVencimento: p.data_vencimento,
        valorAmortizacao: Number(p.valor_amortizacao),
        valorJuros: Number(p.valor_juros),
        valorTotal: Number(p.valor_total),
        saldoDevedorApos: Number(p.saldo_devedor_apos),
        status: p.status,
        dataPagamento: p.data_pagamento,
        valorPago: p.valor_pago ? Number(p.valor_pago) : undefined,
        metodoPagamento: p.metodo_pagamento,
        loteFolhaId: p.lote_folha_id,
        comprovanteUrl: p.comprovante_url,
        observacao: p.observacao,
        responsavelBaixaId: p.responsavel_baixa_id,
        responsavelBaixaNome: p.responsavel_baixa_nome,
        baixadoEm: p.baixado_em
      }))

      return mapDbRowToEmprestimo(e, parcelas)
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetEmprestimoById dedicated]', err)
  }

  // 2. Fallback
  try {
    const { data } = await sb
      .from('relatorios_records')
      .select('*')
      .eq('id', `credimpacto:emp:${id}`)
      .maybeSingle()

    if (data && data.dados) {
      return {
        ...data.dados,
        id,
        createdAt: data.created_at,
        updatedAt: data.dados.updatedAt || data.created_at
      }
    }
  } catch (e) {}

  return null
}

export async function dbSaveEmprestimo(
  emprestimo: CredImpactoEmprestimo,
  autor: { id: string; nome: string; perfil?: string },
  acaoAudit: CredImpactoAuditLog['acao'] = 'CRIACAO',
  justificativa?: string
): Promise<CredImpactoEmprestimo> {
  const sb = getAdminClient()
  const previous = await dbGetEmprestimoById(emprestimo.id)

  const nowIso = new Date().toISOString()
  const updatedLoan: CredImpactoEmprestimo = {
    ...emprestimo,
    updatedAt: nowIso
  }

  // Recalcula totais amortizados e saldo devedor real a partir das parcelas
  if (updatedLoan.parcelas && updatedLoan.parcelas.length > 0) {
    const parcelasPagas = updatedLoan.parcelas.filter(
      (p) => p.status === 'descontada' || p.status === 'paga_avulso'
    )
    const totalAmortizado = roundMoney(
      parcelasPagas.reduce((acc, p) => acc + (p.valorAmortizacao || 0), 0)
    )
    updatedLoan.totalAmortizado = totalAmortizado
    updatedLoan.saldoDevedorAtual = roundMoney(
      Math.max(0, updatedLoan.valorAprovado - totalAmortizado)
    )

    // Se quitou todas as parcelas
    if (
      updatedLoan.saldoDevedorAtual === 0 &&
      parcelasPagas.length === updatedLoan.quantidadeParcelas &&
      updatedLoan.status === 'ativo'
    ) {
      updatedLoan.status = 'quitado'
      updatedLoan.quitadoEm = nowIso
    }
  }

  // 1. Tenta salvar na tabela dedicada
  let dedicatedSaved = false
  try {
    const row = {
      id: updatedLoan.id,
      codigo_operacao: updatedLoan.codigoOperacao,
      colaborador_id: updatedLoan.colaboradorId,
      colaborador_nome: updatedLoan.colaboradorNome,
      colaborador_cpf: updatedLoan.colaboradorCpf,
      colaborador_email: updatedLoan.colaboradorEmail || null,
      colaborador_cargo: updatedLoan.colaboradorCargo || null,
      colaborador_matricula: updatedLoan.colaboradorMatricula || null,
      colaborador_salario_base: updatedLoan.colaboradorSalarioBase || null,
      valor_solicitado: updatedLoan.valorSolicitado,
      valor_aprovado: updatedLoan.valorAprovado,
      quantidade_parcelas: updatedLoan.quantidadeParcelas,
      taxa_mensal: updatedLoan.taxaMensal,
      metodo_calculo: updatedLoan.metodoCalculo,
      total_juros: updatedLoan.totalJuros,
      total_a_pagar: updatedLoan.totalAPagar,
      saldo_devedor_atual: updatedLoan.saldoDevedorAtual,
      total_amortizado: updatedLoan.totalAmortizado,
      status: updatedLoan.status,
      motivo_recusa: updatedLoan.motivoRecusa || null,
      justificativa_solicitacao: updatedLoan.justificativaSolicitacao || null,
      finalidade: updatedLoan.finalidade || null,
      contraproposta: updatedLoan.contraproposta || null,
      dados_bancarios: updatedLoan.dadosBancarios || null,
      comprovante_liberacao_url: updatedLoan.comprovanteLiberacaoUrl || null,
      liberado_por_id: updatedLoan.liberadoPorId || null,
      liberado_por_nome: updatedLoan.liberadoPorNome || null,
      data_liberacao: updatedLoan.dataLiberacao || null,
      contrato_conteudo_html: updatedLoan.contratoConteudoHtml || null,
      contrato_hash_sha256: updatedLoan.contratoHashSha256 || null,
      codigo_verificacao_assinatura: updatedLoan.codigoVerificacaoAssinatura || null,
      termo_autorizacao_desconto: updatedLoan.termoAutorizacaoDesconto || null,
      assinado_em: updatedLoan.assinadoEm || null,
      assinante_ip: updatedLoan.assinanteIp || null,
      assinante_user_agent: updatedLoan.assinanteUserAgent || null,
      assinante_documento: updatedLoan.assinanteDocumento || null,
      quitado_em: updatedLoan.quitadoEm || null,
      cancelado_em: updatedLoan.canceladoEm || null,
      cancelado_por_id: updatedLoan.canceladoPorId || null,
      cancelado_por_nome: updatedLoan.canceladoPorNome || null,
      motivo_cancelamento: updatedLoan.motivoCancelamento || null,
      criado_por_tipo: updatedLoan.criadoPorTipo,
      criado_por_id: updatedLoan.criadoPorId || null,
      criado_por_nome: updatedLoan.criadoPorNome || null,
      memoria_calculo: updatedLoan.memoriaCalculo || null,
      updated_at: nowIso
    }

    const { error: empError } = await sb.from('credimpacto_emprestimos').upsert(row)
    if (!empError) {
      dedicatedSaved = true

      // Salva parcelas na tabela dedicada
      if (updatedLoan.parcelas && updatedLoan.parcelas.length > 0) {
        const parcRows = updatedLoan.parcelas.map((p) => ({
          id: p.id,
          emprestimo_id: updatedLoan.id,
          numero: p.numero,
          competencia: p.competencia,
          data_vencimento: p.dataVencimento,
          valor_amortizacao: p.valorAmortizacao,
          valor_juros: p.valorJuros,
          valor_total: p.valorTotal,
          saldo_devedor_apos: p.saldoDevedorApos,
          status: p.status,
          data_pagamento: p.dataPagamento || null,
          valor_pago: p.valorPago || null,
          metodo_pagamento: p.metodoPagamento || null,
          lote_folha_id: p.loteFolhaId || null,
          comprovante_url: p.comprovanteUrl || null,
          observacao: p.observacao || null,
          responsavel_baixa_id: p.responsavelBaixaId || null,
          responsavel_baixa_nome: p.responsavelBaixaNome || null,
          baixado_em: p.baixadoEm || null,
          updated_at: nowIso
        }))

        await sb.from('credimpacto_parcelas').upsert(parcRows)
      }
    }
  } catch (err: any) {
    // Segue para fallback
  }

  // 2. Sempre persiste também no fallback resiliente
  try {
    await sb.from('relatorios_records').upsert({
      id: `credimpacto:emp:${updatedLoan.id}`,
      dados: updatedLoan,
      created_at: updatedLoan.createdAt || nowIso
    })
  } catch (err) {
    console.error('[dbSaveEmprestimo fallback]', err)
  }

  // 3. Registra auditoria
  await dbRegistrarAuditLog({
    id: crypto.randomUUID(),
    entidadeTipo: 'emprestimo',
    entidadeId: updatedLoan.id,
    acao: acaoAudit,
    autorId: autor.id,
    autorNome: autor.nome,
    autorPerfil: autor.perfil,
    dadosAnteriores: previous,
    dadosNovos: updatedLoan,
    justificativa: justificativa || `Operação ${acaoAudit} do empréstimo ${updatedLoan.codigoOperacao}`,
    createdAt: nowIso
  })

  return updatedLoan
}

export async function dbDeleteEmprestimo(
  id: string,
  autor: { id: string; nome: string; perfil?: string },
  justificativa: string = 'Exclusão de empréstimo solicitada pelo gestor'
): Promise<boolean> {
  const sb = getAdminClient()
  const previous = await dbGetEmprestimoById(id)
  if (!previous) return false

  // 1. Tenta deletar da tabela dedicada
  try {
    await sb.from('credimpacto_parcelas').delete().eq('emprestimo_id', id)
    await sb.from('credimpacto_emprestimos').delete().eq('id', id)
  } catch (err) {}

  // 2. Deleta do fallback relatorios_records
  try {
    await sb.from('relatorios_records').delete().eq('id', `credimpacto:emp:${id}`)
  } catch (err) {}

  // 3. Registra auditoria
  try {
    await dbRegistrarAuditLog({
      id: crypto.randomUUID(),
      entidadeTipo: 'emprestimo',
      entidadeId: id,
      acao: 'EXCLUSAO',
      autorId: autor.id,
      autorNome: autor.nome,
      autorPerfil: autor.perfil,
      dadosAnteriores: previous,
      justificativa: `${justificativa} (Operação: ${previous.codigoOperacao} - ${previous.colaboradorNome})`,
      createdAt: new Date().toISOString()
    })
  } catch (err) {}

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONCILIAÇÃO MENSAL DE FOLHA DE PAGAMENTO
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetParcelasFolha(competencia?: string): Promise<
  Array<
    CredImpactoParcela & {
      colaboradorNome: string
      colaboradorCpf: string
      colaboradorMatricula?: string
      codigoOperacao: string
    }
  >
> {
  const emprestimos = await dbGetEmprestimos()
  const result: Array<
    CredImpactoParcela & {
      colaboradorNome: string
      colaboradorCpf: string
      colaboradorMatricula?: string
      codigoOperacao: string
    }
  > = []

  for (const emp of emprestimos) {
    // Considera empréstimos que estejam ativos ou quitados (para histórico de competência)
    if (['ativo', 'quitado', 'aguardando_liberacao'].includes(emp.status)) {
      for (const p of emp.parcelas || []) {
        if (!competencia || p.competencia === competencia) {
          result.push({
            ...p,
            colaboradorNome: emp.colaboradorNome,
            colaboradorCpf: emp.colaboradorCpf,
            colaboradorMatricula: emp.colaboradorMatricula,
            codigoOperacao: emp.codigoOperacao
          })
        }
      }
    }
  }

  return result.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
}

export async function dbConciliarParcela(
  parcelaId: string,
  dadosBaixa: {
    valorPago: number
    metodoPagamento: CredImpactoParcela['metodoPagamento']
    dataPagamento?: string
    comprovanteUrl?: string
    observacao?: string
    loteFolhaId?: string
  },
  autor: { id: string; nome: string; perfil?: string }
): Promise<{ success: boolean; emprestimo: CredImpactoEmprestimo; parcela: CredImpactoParcela }> {
  const emprestimos = await dbGetEmprestimos()
  let targetLoan: CredImpactoEmprestimo | null = null
  let targetParcela: CredImpactoParcela | null = null

  for (const emp of emprestimos) {
    const found = (emp.parcelas || []).find((p) => p.id === parcelaId)
    if (found) {
      targetLoan = emp
      targetParcela = found
      break
    }
  }

  if (!targetLoan || !targetParcela) {
    throw new Error('Parcela não encontrada.')
  }

  if (targetParcela.status === 'descontada' || targetParcela.status === 'paga_avulso') {
    throw new Error('Esta parcela já foi baixada anteriormente.')
  }

  const nowIso = new Date().toISOString()
  const todayDate = nowIso.split('T')[0]

  targetParcela.status =
    dadosBaixa.metodoPagamento === 'folha_pagamento' ? 'descontada' : 'paga_avulso'
  targetParcela.valorPago = roundMoney(dadosBaixa.valorPago)
  targetParcela.dataPagamento = dadosBaixa.dataPagamento || todayDate
  targetParcela.metodoPagamento = dadosBaixa.metodoPagamento
  targetParcela.comprovanteUrl = dadosBaixa.comprovanteUrl
  targetParcela.observacao = dadosBaixa.observacao
  targetParcela.loteFolhaId = dadosBaixa.loteFolhaId
  targetParcela.responsavelBaixaId = autor.id
  targetParcela.responsavelBaixaNome = autor.nome
  targetParcela.baixadoEm = nowIso

  // Salva o empréstimo atualizado com recalculo de saldo devedor
  const updatedLoan = await dbSaveEmprestimo(
    targetLoan,
    autor,
    'CONCILIACAO_FOLHA',
    `Baixa da parcela ${targetParcela.numero}/${targetLoan.quantidadeParcelas} via ${targetParcela.metodoPagamento}`
  )

  return { success: true, emprestimo: updatedLoan, parcela: targetParcela }
}

export async function dbEstornarParcela(
  parcelaId: string,
  justificativa: string,
  autor: { id: string; nome: string; perfil?: string }
): Promise<{ success: boolean; emprestimo: CredImpactoEmprestimo; parcela: CredImpactoParcela }> {
  if (!justificativa || justificativa.trim().length < 5) {
    throw new Error('Justificativa obrigatória para estorno de baixa.')
  }

  const emprestimos = await dbGetEmprestimos()
  let targetLoan: CredImpactoEmprestimo | null = null
  let targetParcela: CredImpactoParcela | null = null

  for (const emp of emprestimos) {
    const found = (emp.parcelas || []).find((p) => p.id === parcelaId)
    if (found) {
      targetLoan = emp
      targetParcela = found
      break
    }
  }

  if (!targetLoan || !targetParcela) {
    throw new Error('Parcela não encontrada.')
  }

  if (targetParcela.status !== 'descontada' && targetParcela.status !== 'paga_avulso') {
    throw new Error('Apenas parcelas já quitadas ou descontadas podem ser estornadas.')
  }

  const dadosAnteriores = { ...targetParcela }

  targetParcela.status = 'prevista'
  targetParcela.valorPago = undefined
  targetParcela.dataPagamento = undefined
  targetParcela.metodoPagamento = undefined
  targetParcela.comprovanteUrl = undefined
  targetParcela.responsavelBaixaId = undefined
  targetParcela.responsavelBaixaNome = undefined
  targetParcela.baixadoEm = undefined
  targetParcela.observacao = `Estornado em ${new Date().toLocaleDateString('pt-BR')}: ${justificativa}`

  // Se o empréstimo estava quitado, reabre para ativo
  if (targetLoan.status === 'quitado') {
    targetLoan.status = 'ativo'
    targetLoan.quitadoEm = undefined
  }

  const updatedLoan = await dbSaveEmprestimo(
    targetLoan,
    autor,
    'ESTORNO_BAIXA',
    `Estorno da parcela ${targetParcela.numero}: ${justificativa}`
  )

  return { success: true, emprestimo: updatedLoan, parcela: targetParcela }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. QUITAÇÃO ANTECIPADA
// ─────────────────────────────────────────────────────────────────────────────

export async function dbProcessarQuitacaoAntecipada(
  emprestimoId: string,
  dadosQuitacao: {
    valorPago: number
    metodoPagamento: CredImpactoParcela['metodoPagamento']
    comprovanteUrl?: string
    observacao?: string
  },
  autor: { id: string; nome: string; perfil?: string }
): Promise<CredImpactoEmprestimo> {
  const loan = await dbGetEmprestimoById(emprestimoId)
  if (!loan) throw new Error('Empréstimo não encontrado.')
  if (loan.status !== 'ativo') throw new Error('Apenas empréstimos ativos podem ser quitados.')

  const nowIso = new Date().toISOString()
  const todayDate = nowIso.split('T')[0]

  // Cancela parcelas futuras ainda não pagas e zera saldo devedor
  loan.parcelas = (loan.parcelas || []).map((p) => {
    if (p.status === 'prevista' || p.status === 'exportada_folha' || p.status === 'atrasada') {
      return {
        ...p,
        status: 'cancelada',
        observacao: `Dispensada por Quitação Antecipada em ${todayDate}.`
      }
    }
    return p
  })

  loan.status = 'quitado'
  loan.quitadoEm = nowIso
  loan.totalAmortizado = loan.valorAprovado
  loan.saldoDevedorAtual = 0

  return await dbSaveEmprestimo(
    loan,
    autor,
    'QUITACAO_ANTECIPADA',
    `Quitação antecipada liquidada no valor de R$ ${dadosQuitacao.valorPago.toFixed(2)}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. AUDITORIA IMUTÁVEL
// ─────────────────────────────────────────────────────────────────────────────

export async function dbRegistrarAuditLog(log: CredImpactoAuditLog): Promise<void> {
  const sb = getAdminClient()

  // 1. Tenta tabela dedicada
  try {
    const row = {
      id: log.id || crypto.randomUUID(),
      entidade_tipo: log.entidadeTipo,
      entidade_id: log.entidadeId,
      acao: log.acao,
      autor_id: log.autorId,
      autor_nome: log.autorNome,
      autor_perfil: log.autorPerfil || null,
      dados_anteriores: log.dadosAnteriores || null,
      dados_novos: log.dadosNovos || null,
      justificativa: log.justificativa || null,
      ip_address: log.ipAddress || null,
      user_agent: log.userAgent || null,
      created_at: log.createdAt || new Date().toISOString()
    }

    const { error } = await sb.from('credimpacto_audit_logs').insert(row)
    if (!error) return
  } catch (err) {}

  // 2. Fallback resiliente
  try {
    await sb.from('relatorios_records').insert({
      id: `credimpacto:audit:${log.id || crypto.randomUUID()}`,
      dados: log,
      created_at: log.createdAt || new Date().toISOString()
    })
  } catch (err) {
    console.warn('[dbRegistrarAuditLog fallback error]', err)
  }
}

export async function dbGetAuditLogs(entidadeId?: string): Promise<CredImpactoAuditLog[]> {
  const sb = getAdminClient()

  // 1. Tenta tabela dedicada
  try {
    let query = sb
      .from('credimpacto_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (entidadeId) {
      query = query.eq('entidade_id', entidadeId)
    }

    const { data, error } = await query
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: r.id,
        entidadeTipo: r.entidade_tipo,
        entidadeId: r.entidade_id,
        acao: r.acao,
        autorId: r.autor_id,
        autorNome: r.autor_nome,
        autorPerfil: r.autor_perfil,
        dadosAnteriores: r.dados_anteriores,
        dadosNovos: r.dados_novos,
        justificativa: r.justificativa,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        createdAt: r.created_at
      }))
    }
  } catch (err) {}

  // 2. Fallback
  try {
    const { data } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', 'credimpacto:audit:%')
      .order('created_at', { ascending: false })
      .limit(100)

    let list = (data || []).map((r: any) => ({
      ...r.dados,
      id: r.id.replace('credimpacto:audit:', ''),
      createdAt: r.created_at
    }))

    if (entidadeId) {
      list = list.filter((l: any) => l.entidadeId === entidadeId)
    }

    return list
  } catch (e) {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER DE MAPEAMENTO
// ─────────────────────────────────────────────────────────────────────────────

function mapDbRowToEmprestimo(e: any, parcelas: CredImpactoParcela[]): CredImpactoEmprestimo {
  return {
    id: e.id,
    codigoOperacao: e.codigo_operacao || e.codigoOperacao,
    colaboradorId: e.colaborador_id || e.colaboradorId,
    colaboradorNome: e.colaborador_nome || e.colaboradorNome,
    colaboradorCpf: e.colaborador_cpf || e.colaboradorCpf,
    colaboradorEmail: e.colaborador_email || e.colaboradorEmail,
    colaboradorCargo: e.colaborador_cargo || e.colaboradorCargo,
    colaboradorMatricula: e.colaborador_matricula || e.colaboradorMatricula,
    colaboradorSalarioBase: e.colaborador_salario_base ? Number(e.colaborador_salario_base) : undefined,
    valorSolicitado: Number(e.valor_solicitado || e.valorSolicitado),
    valorAprovado: Number(e.valor_aprovado || e.valorAprovado),
    quantidadeParcelas: Number(e.quantidade_parcelas || e.quantidadeParcelas),
    taxaMensal: Number(e.taxa_mensal || e.taxaMensal),
    metodoCalculo: e.metodo_calculo || e.metodoCalculo,
    totalJuros: Number(e.total_juros || e.totalJuros || 0),
    totalAPagar: Number(e.total_a_pagar || e.totalAPagar),
    saldoDevedorAtual: Number(e.saldo_devedor_atual || e.saldoDevedorAtual || 0),
    totalAmortizado: Number(e.total_amortizado || e.totalAmortizado || 0),
    status: e.status,
    motivoRecusa: e.motivo_recusa || e.motivoRecusa,
    justificativaSolicitacao: e.justificativa_solicitacao || e.justificativaSolicitacao,
    finalidade: e.finalidade,
    contraproposta: e.contraproposta,
    dadosBancarios: e.dados_bancarios || e.dadosBancarios,
    comprovanteLiberacaoUrl: e.comprovante_liberacao_url || e.comprovanteLiberacaoUrl,
    liberadoPorId: e.liberado_por_id || e.liberadoPorId,
    liberadoPorNome: e.liberado_por_nome || e.liberadoPorNome,
    dataLiberacao: e.data_liberacao || e.dataLiberacao,
    contratoConteudoHtml: e.contrato_conteudo_html || e.contratoConteudoHtml,
    contratoHashSha256: e.contrato_hash_sha256 || e.contratoHashSha256,
    codigoVerificacaoAssinatura: e.codigo_verificacao_assinatura || e.codigoVerificacaoAssinatura,
    termoAutorizacaoDesconto: e.termo_autorizacao_desconto || e.termoAutorizacaoDesconto,
    assinadoEm: e.assinado_em || e.assinadoEm,
    assinanteIp: e.assinante_ip || e.assinanteIp,
    assinanteUserAgent: e.assinante_user_agent || e.assinanteUserAgent,
    assinanteDocumento: e.assinante_documento || e.assinanteDocumento,
    quitadoEm: e.quitado_em || e.quitadoEm,
    canceladoEm: e.cancelado_em || e.canceladoEm,
    canceladoPorId: e.cancelado_por_id || e.canceladoPorId,
    canceladoPorNome: e.cancelado_por_nome || e.canceladoPorNome,
    motivoCancelamento: e.motivo_cancelamento || e.motivoCancelamento,
    criadoPorTipo: e.criado_por_tipo || e.criadoPorTipo || 'colaborador',
    criadoPorId: e.criado_por_id || e.criadoPorId,
    criadoPorNome: e.criado_por_nome || e.criadoPorNome,
    memoriaCalculo: e.memoria_calculo || e.memoriaCalculo,
    parcelas: parcelas.length > 0 ? parcelas : e.parcelas || [],
    createdAt: e.created_at || e.createdAt,
    updatedAt: e.updated_at || e.updatedAt
  }
}
