import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  type RateioCentroCustoItem,
  normalizarContaPagar,
} from '@/app/(app)/financeiro/pagar/types'

export const dynamic = 'force-dynamic'

const CFG_KEY_MOVS_CAIXA = 'fin_movimentacoes_caixa_v1'
const CFG_KEY_MOVS_OVERRIDES = 'fin_movimentacoes_overrides_v1'
const CFG_KEY_CONTAS = 'fin_contas_pagar_v1'
const CFG_KEY_FORNECEDORES = 'fin_fornecedores_pagar_v1'

export interface ComposicaoPagamentoItem {
  id: string
  tipoRecurso: string
  valor: number
  documentoRef?: string
  bancoCartao?: string
  compensado?: boolean
}

export interface MovimentacaoCaixaRecord {
  id: string
  codigoLcto: number
  caixaId: string
  caixaCodigo: string
  caixaDescricao: string
  dataLcto: string // YYYY-MM-DD
  emissaoDocto: string // YYYY-MM-DD
  tipoOperacao: 'Pagamento' | 'Recebimento'
  tipoTransacao: 'Normal' | 'Transferência' | 'Estorno' | 'Ajuste'
  categoriaOrigem: 'compromisso' | 'transf_valores' | 'rec_aluno' | 'mov_receita'
  fornecedorId: string
  fornecedorNome: string
  descricao: string
  valor: number
  desconto?: number
  juros?: number
  multa?: number
  valorLiquido: number
  contaPlanoId: string
  contaPlanoLabel: string
  centroCusto: string
  rateio?: RateioCentroCustoItem[]
  tipoDocumento: string
  numeroDocumento: string
  tipoRecurso: string
  composicaoPagamento?: ComposicaoPagamentoItem[]
  compensadoBanco: 'Sim' | 'Não'
  observacao: string
  operador: string
  estornado?: boolean
  motivoEstorno?: string
  dataEstorno?: string
  referenciaOrigemId?: string
  transferenciaParId?: string
  caixaTransferenciaRelacionado?: string
  createdAt: string
  updatedAt: string
  historico?: {
    id: string
    data: string
    acao: string
    usuario: string
    detalhes?: string
  }[]
}

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const admin = getAdminClient()
    const hojeStr = new Date().toISOString().split('T')[0]

    const [cfgRes, titulosRes, movsTableRes, mantRes] = await Promise.all([
      admin
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'cfgCaixas',
          CFG_KEY_MOVS_CAIXA,
          CFG_KEY_MOVS_OVERRIDES,
          CFG_KEY_CONTAS,
          CFG_KEY_FORNECEDORES,
          'cfgPlanoContas',
          'cfgCentrosCusto',
          'cfgTiposDocumento',
          'cfgMetodosPagamento',
        ]),
      admin
        .from('titulos')
        .select('*')
        .eq('status', 'pago')
        .order('pagamento', { ascending: false })
        .limit(2500)
        .then((r: any) => r, () => ({ data: [] })),
      admin
        .from('movimentacoes')
        .select('*')
        .order('data', { ascending: false })
        .limit(1500)
        .then((r: any) => r, () => ({ data: [] })),
      admin
        .from('mantenedores')
        .select('*')
        .limit(50)
        .then((r: any) => r, () => ({ data: [] })),
    ])

    const cfgMap = new Map<string, any>()
    for (const row of cfgRes.data || []) {
      cfgMap.set(row.chave, row.valor)
    }

    const SIMULATED_CAIXAS = new Set(['CX-108', 'CX-102', 'CX-98', 'CX-94', 'CX-19', 'CX-11', 'CX-1'])
    const rawCaixas: any[] = Array.isArray(cfgMap.get('cfgCaixas')) ? cfgMap.get('cfgCaixas') : []
    const caixas = rawCaixas.filter(
      (c: any) => c && typeof c === 'object' && !SIMULATED_CAIXAS.has(String(c.id || '').trim())
    )

    const movimentacoesManuais: MovimentacaoCaixaRecord[] = Array.isArray(cfgMap.get(CFG_KEY_MOVS_CAIXA))
      ? cfgMap.get(CFG_KEY_MOVS_CAIXA)
      : []

    const overrides: Record<string, Partial<MovimentacaoCaixaRecord>> =
      cfgMap.get(CFG_KEY_MOVS_OVERRIDES) && typeof cfgMap.get(CFG_KEY_MOVS_OVERRIDES) === 'object'
        ? cfgMap.get(CFG_KEY_MOVS_OVERRIDES)
        : {}

    const rawContas: any[] = Array.isArray(cfgMap.get(CFG_KEY_CONTAS)) ? cfgMap.get(CFG_KEY_CONTAS) : []
    const contasPagarPagas: ContaPagarRecord[] = rawContas
      .map((item, idx) => normalizarContaPagar(item, idx, hojeStr))
      .filter((c) => c.status === 'pago')

    const titulosPagos: any[] = Array.isArray(titulosRes?.data)
      ? titulosRes.data.map((row: any) => ({
          ...row,
          ...(row.dados || {}),
          id: row.id,
          status: row.status,
          valor: Number(row.valor ?? row.dados?.valor ?? 0),
          pagamento: row.pagamento || row.dados?.pagamento || null,
          vencimento: row.vencimento || row.dados?.vencimento || '',
          aluno: row.aluno || row.dados?.aluno || '',
          responsavel: row.responsavel || row.dados?.responsavel || '',
          descricao: row.descricao || row.dados?.descricao || '',
          metodo: row.metodo || row.dados?.metodo || 'PIX',
        }))
      : []

    const movsTabela: any[] = Array.isArray(movsTableRes?.data)
      ? movsTableRes.data.map((row: any) => ({
          ...row,
          ...(row.dados || {}),
          id: row.id,
        }))
      : []

    const fornecedores: FornecedorEscolar[] = Array.isArray(cfgMap.get(CFG_KEY_FORNECEDORES))
      ? cfgMap.get(CFG_KEY_FORNECEDORES)
      : []

    const planoContas: any[] = Array.isArray(cfgMap.get('cfgPlanoContas')) ? cfgMap.get('cfgPlanoContas') : []
    const centrosCusto: any[] = Array.isArray(cfgMap.get('cfgCentrosCusto')) ? cfgMap.get('cfgCentrosCusto') : []
    const tiposDocumento: any[] = Array.isArray(cfgMap.get('cfgTiposDocumento')) ? cfgMap.get('cfgTiposDocumento') : []
    const metodosPagamento: any[] = Array.isArray(cfgMap.get('cfgMetodosPagamento'))
      ? cfgMap.get('cfgMetodosPagamento')
      : []

    const mantenedores: any[] = Array.isArray(mantRes?.data)
      ? mantRes.data.map((row: any) => ({
          ...row,
          unidades: row.unidades ?? [],
          ...(row.dados || {}),
        }))
      : []

    return NextResponse.json({
      ok: true,
      caixas,
      movimentacoesManuais,
      overrides,
      contasPagarPagas,
      titulosPagos,
      movsTabela,
      fornecedores,
      planoContas,
      centrosCusto,
      tiposDocumento,
      metodosPagamento,
      mantenedores,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar movimentações financeiras' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const action = String(body?.action || '')
    const admin = getAdminClient()
    const nowISO = new Date().toISOString()
    const hojeStr = nowISO.split('T')[0]
    const operador = body?.operador || user?.email || 'Operador Financeiro'

    const { data: cfgRows } = await admin
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        'cfgCaixas',
        CFG_KEY_MOVS_CAIXA,
        CFG_KEY_MOVS_OVERRIDES,
        CFG_KEY_CONTAS,
      ])

    const cfgMap = new Map<string, any>()
    for (const row of cfgRows || []) {
      cfgMap.set(row.chave, row.valor)
    }

    let caixas: any[] = Array.isArray(cfgMap.get('cfgCaixas')) ? [...cfgMap.get('cfgCaixas')] : []
    let movsManuais: MovimentacaoCaixaRecord[] = Array.isArray(cfgMap.get(CFG_KEY_MOVS_CAIXA))
      ? [...cfgMap.get(CFG_KEY_MOVS_CAIXA)]
      : []
    let overrides: Record<string, Partial<MovimentacaoCaixaRecord>> =
      cfgMap.get(CFG_KEY_MOVS_OVERRIDES) && typeof cfgMap.get(CFG_KEY_MOVS_OVERRIDES) === 'object'
        ? { ...cfgMap.get(CFG_KEY_MOVS_OVERRIDES) }
        : {}
    let contasPagar: ContaPagarRecord[] = Array.isArray(cfgMap.get(CFG_KEY_CONTAS))
      ? cfgMap.get(CFG_KEY_CONTAS).map((c: any, idx: number) => normalizarContaPagar(c, idx, hojeStr))
      : []

    const nextCodigoLcto = () => {
      let maxCod = 88000
      for (const m of movsManuais) {
        if (Number(m.codigoLcto) > maxCod) maxCod = Number(m.codigoLcto)
      }
      for (const ov of Object.values(overrides)) {
        if (Number(ov?.codigoLcto) > maxCod) maxCod = Number(ov?.codigoLcto)
      }
      return maxCod + 1
    }

    // 1. SALVAR OU EDITAR MOVIMENTAÇÃO (Manual ou Override de Baixa Automática)
    if (action === 'save_movimentacao') {
      const payload = body.movimentacao as Partial<MovimentacaoCaixaRecord> & {
        isAutomaticOrigin?: boolean
        sourceId?: string
      }

      if (!payload || !payload.caixaId) {
        return NextResponse.json({ error: 'Caixa é obrigatório para registrar a movimentação.' }, { status: 400 })
      }

      const cxAlvo = caixas.find((c) => c.id === payload.caixaId || c.codigo === payload.caixaId)
      if (cxAlvo && cxAlvo.situacao === 'Fechado') {
        return NextResponse.json(
          { error: `O Caixa ${cxAlvo.codigo} - ${cxAlvo.descricao} está Fechado. Reabra o caixa antes de registrar ou editar lançamentos.` },
          { status: 400 }
        )
      }

      // Se for edição de um lançamento automático (Compromisso / Contas a Pagar ou Rec. Aluno / Contas a Receber)
      if (payload.isAutomaticOrigin && payload.sourceId) {
        const key = String(payload.id || payload.sourceId)
        const prevOv = overrides[key] || {}
        overrides[key] = {
          ...prevOv,
          descricao: payload.descricao,
          fornecedorId: payload.fornecedorId,
          fornecedorNome: payload.fornecedorNome,
          contaPlanoId: payload.contaPlanoId,
          contaPlanoLabel: payload.contaPlanoLabel,
          centroCusto: payload.centroCusto,
          rateio: payload.rateio,
          tipoDocumento: payload.tipoDocumento,
          numeroDocumento: payload.numeroDocumento,
          emissaoDocto: payload.emissaoDocto,
          tipoRecurso: payload.tipoRecurso,
          composicaoPagamento: payload.composicaoPagamento,
          compensadoBanco: payload.compensadoBanco,
          observacao: payload.observacao,
          dataLcto: payload.dataLcto,
          updatedAt: nowISO,
          historico: [
            ...(prevOv.historico || []),
            {
              id: `hist-ov-${Date.now()}`,
              data: nowISO,
              acao: 'Movimentação Complementada / Editada no Caixa',
              usuario: operador,
              detalhes: `Conta Plano: ${payload.contaPlanoLabel || '—'} | C. Custo: ${payload.centroCusto || '—'} | Compensado: ${payload.compensadoBanco || 'Sim'}`,
            },
          ],
        }

        await admin
          .from('configuracoes')
          .upsert({ chave: CFG_KEY_MOVS_OVERRIDES, valor: overrides, updated_at: nowISO }, { onConflict: 'chave' })

        // Se for Compromisso (Contas a Pagar), atualiza também o registro de origem em fin_contas_pagar_v1
        if (payload.categoriaOrigem === 'compromisso') {
          const cpIdx = contasPagar.findIndex((c) => c.id === payload.sourceId)
          if (cpIdx >= 0) {
            const atual = contasPagar[cpIdx]
            contasPagar[cpIdx] = normalizarContaPagar(
              {
                ...atual,
                descricao: payload.descricao || atual.descricao,
                fornecedorNome: payload.fornecedorNome || atual.fornecedorNome,
                planoContasId: payload.contaPlanoId || atual.planoContasId,
                centroCusto: payload.centroCusto ?? atual.centroCusto,
                rateio: payload.rateio ?? atual.rateio,
                numeroDocumento: payload.numeroDocumento ?? atual.numeroDocumento,
                tipoDocumento: (payload.tipoDocumento as any) || atual.tipoDocumento,
                formaPagamento: (payload.tipoRecurso as any) || atual.formaPagamento,
                dataPagamento: payload.dataLcto || atual.dataPagamento,
                observacoes: payload.observacao ?? atual.observacoes,
                updatedAt: nowISO,
                historico: [
                  ...(atual.historico || []),
                  {
                    id: `hist-cp-mov-${Date.now()}`,
                    data: nowISO,
                    acao: 'Editado via Movimentação Financeira',
                    usuario: operador,
                    detalhes: `Atualizado no Caixa ${payload.caixaCodigo || payload.caixaId}.`,
                  },
                ],
              },
              cpIdx,
              hojeStr
            )
            await admin
              .from('configuracoes')
              .upsert({ chave: CFG_KEY_CONTAS, valor: contasPagar, updated_at: nowISO }, { onConflict: 'chave' })
          }
        }

        ;(globalThis as any).configCache?.clear?.()
        return NextResponse.json({ ok: true, overrides, movimentacoesManuais: movsManuais })
      }

      // Lançamento direto no Caixa (Novo ou Edição de Movimentação Manual)
      const existingIdx = payload.id ? movsManuais.findIndex((m) => m.id === payload.id) : -1
      const existing = existingIdx >= 0 ? movsManuais[existingIdx] : undefined

      const valorBruto = Math.max(0, Number(payload.valor ?? existing?.valor ?? 0))
      const desc = Math.max(0, Number(payload.desconto ?? existing?.desconto ?? 0))
      const jur = Math.max(0, Number(payload.juros ?? existing?.juros ?? 0))
      const mul = Math.max(0, Number(payload.multa ?? existing?.multa ?? 0))
      const valorLiquido = Math.max(0, Math.round((valorBruto - desc + jur + mul) * 100) / 100)

      const record: MovimentacaoCaixaRecord = {
        id: existing?.id || payload.id || `MOV-CX-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        codigoLcto: existing?.codigoLcto || Number(payload.codigoLcto) || nextCodigoLcto(),
        caixaId: String(payload.caixaId),
        caixaCodigo: String(payload.caixaCodigo || existing?.caixaCodigo || ''),
        caixaDescricao: String(payload.caixaDescricao || existing?.caixaDescricao || ''),
        dataLcto: payload.dataLcto || existing?.dataLcto || hojeStr,
        emissaoDocto: payload.emissaoDocto || existing?.emissaoDocto || payload.dataLcto || hojeStr,
        tipoOperacao: payload.tipoOperacao === 'Recebimento' ? 'Recebimento' : 'Pagamento',
        tipoTransacao: payload.tipoTransacao || existing?.tipoTransacao || 'Normal',
        categoriaOrigem: payload.categoriaOrigem || existing?.categoriaOrigem || 'mov_receita',
        fornecedorId: String(payload.fornecedorId ?? existing?.fornecedorId ?? '1'),
        fornecedorNome: String(payload.fornecedorNome || existing?.fornecedorNome || 'Diversos'),
        descricao: String(payload.descricao || existing?.descricao || '').trim(),
        valor: valorBruto,
        desconto: desc,
        juros: jur,
        multa: mul,
        valorLiquido,
        contaPlanoId: String(payload.contaPlanoId ?? existing?.contaPlanoId ?? ''),
        contaPlanoLabel: String(payload.contaPlanoLabel ?? existing?.contaPlanoLabel ?? ''),
        centroCusto: String(payload.centroCusto ?? existing?.centroCusto ?? ''),
        rateio: Array.isArray(payload.rateio) ? payload.rateio : existing?.rateio || [],
        tipoDocumento: String(payload.tipoDocumento ?? existing?.tipoDocumento ?? ''),
        numeroDocumento: String(payload.numeroDocumento ?? existing?.numeroDocumento ?? ''),
        tipoRecurso: String(payload.tipoRecurso || existing?.tipoRecurso || 'PIX'),
        composicaoPagamento: Array.isArray(payload.composicaoPagamento)
          ? payload.composicaoPagamento
          : existing?.composicaoPagamento || [],
        compensadoBanco: payload.compensadoBanco === 'Não' ? 'Não' : 'Sim',
        observacao: String(payload.observacao ?? existing?.observacao ?? ''),
        operador: existing?.operador || operador,
        estornado: Boolean(existing?.estornado),
        createdAt: existing?.createdAt || nowISO,
        updatedAt: nowISO,
        historico: [
          ...(existing?.historico || []),
          {
            id: `hist-${Date.now()}`,
            data: nowISO,
            acao: existing ? 'Movimentação Editada' : 'Movimentação Registrada no Caixa',
            usuario: operador,
            detalhes: `${payload.tipoOperacao || 'Pagamento'} de R$ ${valorLiquido.toFixed(2)} (${payload.tipoRecurso || 'PIX'}) — ${payload.descricao || ''}`,
          },
        ],
      }

      if (existingIdx >= 0) {
        movsManuais[existingIdx] = record
      } else {
        movsManuais.unshift(record)
      }

      await admin
        .from('configuracoes')
        .upsert({ chave: CFG_KEY_MOVS_CAIXA, valor: movsManuais, updated_at: nowISO }, { onConflict: 'chave' })

      ;(globalThis as any).configCache?.clear?.()
      return NextResponse.json({ ok: true, record, movimentacoesManuais: movsManuais })
    }

    // 2. SALVAR RATEIO DE CENTRO DE CUSTO EM QUALQUER LANÇAMENTO
    if (action === 'save_rateio') {
      const movId = String(body.id || '')
      const sourceId = String(body.sourceId || '')
      const isAutomaticOrigin = Boolean(body.isAutomaticOrigin)
      const rateio: RateioCentroCustoItem[] = Array.isArray(body.rateio) ? body.rateio : []
      const centroCustoPrincipal =
        rateio.length > 1
          ? `Rateio (${rateio.length} centros)`
          : rateio[0]?.centroCusto || String(body.centroCusto || '')

      if (isAutomaticOrigin) {
        const key = movId || sourceId
        const prevOv = overrides[key] || {}
        overrides[key] = {
          ...prevOv,
          rateio,
          centroCusto: centroCustoPrincipal,
          updatedAt: nowISO,
          historico: [
            ...(prevOv.historico || []),
            {
              id: `hist-rat-${Date.now()}`,
              data: nowISO,
              acao: 'Rateio de Centro de Custo Atualizado',
              usuario: operador,
              detalhes: `${rateio.length} centro(s) configurado(s): ${rateio.map((r) => `${r.centroCusto} (${r.percentual.toFixed(1)}%)`).join(', ')}`,
            },
          ],
        }
        await admin
          .from('configuracoes')
          .upsert({ chave: CFG_KEY_MOVS_OVERRIDES, valor: overrides, updated_at: nowISO }, { onConflict: 'chave' })

        if (sourceId) {
          const cpIdx = contasPagar.findIndex((c) => c.id === sourceId)
          if (cpIdx >= 0) {
            contasPagar[cpIdx] = {
              ...contasPagar[cpIdx],
              rateio,
              centroCusto: centroCustoPrincipal,
              updatedAt: nowISO,
            }
            await admin
              .from('configuracoes')
              .upsert({ chave: CFG_KEY_CONTAS, valor: contasPagar, updated_at: nowISO }, { onConflict: 'chave' })
          }
        }
      } else {
        const idx = movsManuais.findIndex((m) => m.id === movId)
        if (idx >= 0) {
          movsManuais[idx] = {
            ...movsManuais[idx],
            rateio,
            centroCusto: centroCustoPrincipal,
            updatedAt: nowISO,
            historico: [
              ...(movsManuais[idx].historico || []),
              {
                id: `hist-rat-${Date.now()}`,
                data: nowISO,
                acao: 'Rateio de Centro de Custo Atualizado',
                usuario: operador,
                detalhes: `${rateio.length} centro(s) configurado(s).`,
              },
            ],
          }
          await admin
            .from('configuracoes')
            .upsert({ chave: CFG_KEY_MOVS_CAIXA, valor: movsManuais, updated_at: nowISO }, { onConflict: 'chave' })
        }
      }

      ;(globalThis as any).configCache?.clear?.()
      return NextResponse.json({ ok: true, movsManuais, overrides })
    }

    // 3. EXCLUIR MOVIMENTAÇÃO MANUAL
    if (action === 'delete_movimentacao') {
      const movId = String(body.id || '')
      const target = movsManuais.find((m) => m.id === movId)
      if (!target) {
        return NextResponse.json(
          { error: 'Lançamento manual não encontrado ou é oriundo de baixa automática (utilize Estornar).' },
          { status: 400 }
        )
      }

      // Se for transferência e tiver par vinculado, remove ambos
      const parId = target.transferenciaParId
      movsManuais = movsManuais.filter((m) => m.id !== movId && (!parId || m.id !== parId))

      await admin
        .from('configuracoes')
        .upsert({ chave: CFG_KEY_MOVS_CAIXA, valor: movsManuais, updated_at: nowISO }, { onConflict: 'chave' })

      ;(globalThis as any).configCache?.clear?.()
      return NextResponse.json({ ok: true, movimentacoesManuais: movsManuais })
    }

    // 4. ESTORNAR MOVIMENTAÇÃO (Manual, Transferência, Baixa Contas a Pagar ou Baixa Contas a Receber)
    if (action === 'estornar_movimentacao') {
      const movId = String(body.id || '').trim()
      const rawSourceId = String(body.sourceId || '').trim()
      const categoriaOrigem = String(body.categoriaOrigem || '').trim()
      const motivo = String(body.motivo || 'Estorno operacional realizado na Movimentação Financeira').trim()

      const markOverrideEstornado = (key: string) => {
        if (!key) return
        const prev = (overrides[key] || {}) as any
        overrides[key] = {
          ...prev,
          estornado: true,
          estornadoEm: nowISO,
          updatedAt: nowISO,
          historico: [
            ...(Array.isArray(prev.historico) ? prev.historico : []),
            {
              id: `hist-est-ov-${Date.now()}`,
              data: nowISO,
              acao: 'Estorno Confirmado na Movimentação Financeira',
              usuario: operador,
              detalhes: motivo,
            },
          ],
        } as any
      }

      // Caso A: Compromisso (Baixa de Contas a Pagar)
      if (categoriaOrigem === 'compromisso' || movId.startsWith('CP-')) {
        const cleanSourceId = (rawSourceId || movId).replace(/^CP-/, '')
        markOverrideEstornado(movId || `CP-${cleanSourceId}`)
        markOverrideEstornado(cleanSourceId)

        const cpIdx = contasPagar.findIndex((c) => c.id === cleanSourceId || c.id === rawSourceId)
        if (cpIdx >= 0) {
          const atual = contasPagar[cpIdx]
          contasPagar[cpIdx] = normalizarContaPagar(
            {
              ...atual,
              status: atual.vencimento < hojeStr ? 'vencido' : 'pendente',
              valorPago: 0,
              dataPagamento: undefined,
              updatedAt: nowISO,
              historico: [
                ...(atual.historico || []),
                {
                  id: `hist-est-${Date.now()}`,
                  data: nowISO,
                  acao: 'Estorno de Baixa via Movimentação Financeira',
                  usuario: operador,
                  detalhes: motivo,
                },
              ],
            },
            cpIdx,
            hojeStr
          )
          await admin
            .from('configuracoes')
            .upsert({ chave: CFG_KEY_CONTAS, valor: contasPagar, updated_at: nowISO }, { onConflict: 'chave' })
          await admin
            .from('contas_pagar')
            .upsert(
              {
                id: contasPagar[cpIdx].id,
                status: contasPagar[cpIdx].status,
                dados: contasPagar[cpIdx],
              },
              { onConflict: 'id' }
            )
            .then(() => {}, () => {})
        } else if (cleanSourceId) {
          const { data: cpRow } = await admin
            .from('contas_pagar')
            .select('*')
            .eq('id', cleanSourceId)
            .maybeSingle()
            .then((r: any) => r, () => ({ data: null }))
          if (cpRow) {
            const d = { ...(cpRow.dados || {}), ...cpRow }
            const newSt = (d.vencimento || hojeStr) < hojeStr ? 'vencido' : 'pendente'
            const updatedCp = { ...d, status: newSt, valorPago: 0, dataPagamento: undefined, updatedAt: nowISO }
            await admin
              .from('contas_pagar')
              .update({ status: newSt, dados: updatedCp })
              .eq('id', cleanSourceId)
              .then(() => {}, () => {})
          }
        }

        movsManuais = movsManuais.filter(
          (m) =>
            m.id !== movId &&
            m.id !== cleanSourceId &&
            m.referenciaOrigemId !== cleanSourceId &&
            (m as any).referenciaId !== cleanSourceId
        )
        await Promise.all([
          admin
            .from('configuracoes')
            .upsert({ chave: CFG_KEY_MOVS_OVERRIDES, valor: overrides, updated_at: nowISO }, { onConflict: 'chave' }),
          admin
            .from('configuracoes')
            .upsert({ chave: CFG_KEY_MOVS_CAIXA, valor: movsManuais, updated_at: nowISO }, { onConflict: 'chave' }),
          admin
            .from('movimentacoes')
            .delete()
            .like('id', `mov-cp-${cleanSourceId}%`)
            .then(() => {}, () => {}),
        ])

        ;(globalThis as any).configCache?.clear?.()
        return NextResponse.json({
          ok: true,
          message: 'Baixa de Conta a Pagar estornada com sucesso!',
          movimentacoesManuais: movsManuais,
          overrides,
          contasPagarPagas: contasPagar.filter((c) => c.status === 'pago'),
        })
      }

      // Caso B: Recebimento de Aluno (Baixa de Contas a Receber / Títulos)
      if (categoriaOrigem === 'rec_aluno' || movId.startsWith('REC-')) {
        const cleanSourceId = (rawSourceId || movId).replace(/^REC-/, '')
        markOverrideEstornado(movId || `REC-${cleanSourceId}`)
        markOverrideEstornado(cleanSourceId)

        const { data: tituloRow } = await admin
          .from('titulos')
          .select('*')
          .eq('id', cleanSourceId)
          .maybeSingle()

        if (tituloRow) {
          const venc = tituloRow.vencimento || tituloRow.dados?.vencimento || hojeStr
          const newStatus = venc < hojeStr ? 'atrasado' : 'pendente'
          const updatedDados = {
            ...(tituloRow.dados || {}),
            status: newStatus,
            pagamento: null,
            estornadoEm: nowISO,
            estornadoPor: operador,
            motivoEstorno: motivo,
          }
          const { error: errUpd } = await admin
            .from('titulos')
            .update({
              status: newStatus,
              pagamento: null,
              dados: updatedDados,
              updated_at: nowISO,
            })
            .eq('id', cleanSourceId)
          if (errUpd) {
            await admin
              .from('titulos')
              .update({
                status: newStatus,
                dados: updatedDados,
              })
              .eq('id', cleanSourceId)
              .then(() => {}, () => {})
          }
        }

        movsManuais = movsManuais.filter(
          (m) =>
            m.id !== movId &&
            m.id !== cleanSourceId &&
            m.referenciaOrigemId !== cleanSourceId &&
            (m as any).referenciaId !== cleanSourceId
        )

        const { data: cfgManRow } = await admin
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'cfgMovimentacoesManuais')
          .maybeSingle()
          .then((r: any) => r, () => ({ data: null }))
        if (Array.isArray(cfgManRow?.valor)) {
          const filteredCfgMan = cfgManRow.valor.filter(
            (m: any) =>
              m?.id !== movId &&
              m?.id !== cleanSourceId &&
              m?.referenciaId !== cleanSourceId &&
              m?.referenciaOrigemId !== cleanSourceId
          )
          await admin
            .from('configuracoes')
            .upsert({ chave: 'cfgMovimentacoesManuais', valor: filteredCfgMan, updated_at: nowISO }, { onConflict: 'chave' })
            .then(() => {}, () => {})
        }

        await Promise.all([
          admin
            .from('configuracoes')
            .upsert({ chave: CFG_KEY_MOVS_OVERRIDES, valor: overrides, updated_at: nowISO }, { onConflict: 'chave' }),
          admin
            .from('configuracoes')
            .upsert({ chave: CFG_KEY_MOVS_CAIXA, valor: movsManuais, updated_at: nowISO }, { onConflict: 'chave' }),
          admin
            .from('movimentacoes')
            .delete()
            .eq('id', cleanSourceId)
            .then(() => {}, () => {}),
        ])

        const hasAlunoNoTitulo = Boolean(
          String(tituloRow?.aluno || tituloRow?.dados?.aluno || '').trim()
        )
        ;(globalThis as any).configCache?.clear?.()
        return NextResponse.json({
          ok: true,
          message: hasAlunoNoTitulo
            ? 'Recebimento de Aluno estornado e título reaberto!'
            : 'Recebimento estornado e título reaberto em Contas a Receber!',
          movimentacoesManuais: movsManuais,
          overrides,
        })
      }

      // Caso C: Movimentação Manual ou Transferência entre Caixas
      const idx = movsManuais.findIndex(
        (m, i) =>
          m.id === movId ||
          (rawSourceId && m.id === rawSourceId) ||
          (!m.id && movId === `MAN-${i + 1}`)
      )
      const parId = idx >= 0 ? movsManuais[idx]?.transferenciaParId : undefined
      markOverrideEstornado(movId)
      if (rawSourceId) markOverrideEstornado(rawSourceId)
      if (parId) markOverrideEstornado(parId)

      if (idx >= 0) {
        const targetId = movsManuais[idx].id
        movsManuais = movsManuais.filter(
          (m, i) =>
            i !== idx &&
            (!targetId || m.id !== targetId) &&
            (!parId || m.id !== parId)
        )
      }

      await Promise.all([
        admin
          .from('configuracoes')
          .upsert({ chave: CFG_KEY_MOVS_CAIXA, valor: movsManuais, updated_at: nowISO }, { onConflict: 'chave' }),
        admin
          .from('configuracoes')
          .upsert({ chave: CFG_KEY_MOVS_OVERRIDES, valor: overrides, updated_at: nowISO }, { onConflict: 'chave' }),
      ])

      ;(globalThis as any).configCache?.clear?.()
      return NextResponse.json({ ok: true, movimentacoesManuais: movsManuais, overrides })
    }

    // 5. TRANSFERÊNCIA DE VALORES ENTRE CAIXAS
    if (action === 'transferir_valores') {
      const caixaOrigemId = String(body.caixaOrigemId || '')
      const caixaDestinoId = String(body.caixaDestinoId || '')
      const valor = Math.round(Number(body.valor || 0) * 100) / 100
      const saldoOrigemAtual =
        body.saldoOrigemAtual !== undefined ? Math.round(Number(body.saldoOrigemAtual) * 100) / 100 : undefined
      const fecharCaixaOrigemAposTransferencia = Boolean(body.fecharCaixaOrigemAposTransferencia)
      const dataTransferencia = String(body.dataTransferencia || body.dataLcto || hojeStr)
      const tipoRecurso = String(body.tipoRecurso || 'Transferência / TED')
      const numeroDocumento = String(body.numeroDocumento || '').trim()
      const contaPlanoId = String(body.contaPlanoId || '')
      const contaPlanoLabel = String(body.contaPlanoLabel || 'Transferência entre Caixas / Bancos')
      const centroCusto = String(body.centroCusto || '').trim()
      const observacao = String(body.observacao || '')

      if (!caixaOrigemId || !caixaDestinoId || caixaOrigemId === caixaDestinoId) {
        return NextResponse.json({ error: 'Selecione caixas de origem e destino distintos.' }, { status: 400 })
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        return NextResponse.json(
          { error: 'Só é permitido transferir uma quantidade positiva maior que R$ 0,00.' },
          { status: 400 }
        )
      }
      if (saldoOrigemAtual !== undefined) {
        if (saldoOrigemAtual <= 0) {
          return NextResponse.json(
            { error: 'Transferência bloqueada: o caixa de origem não possui saldo positivo disponível.' },
            { status: 400 }
          )
        }
        if (valor > saldoOrigemAtual + 0.01) {
          return NextResponse.json(
            {
              error: `Transferência bloqueada: o valor informado (R$ ${valor.toFixed(2)}) excede o saldo positivo disponível no caixa (R$ ${saldoOrigemAtual.toFixed(2)}).`,
            },
            { status: 400 }
          )
        }
      }

      const cxOrig = caixas.find((c) => c.id === caixaOrigemId || c.codigo === caixaOrigemId)
      const cxDest = caixas.find((c) => c.id === caixaDestinoId || c.codigo === caixaDestinoId)

      if (cxOrig && cxOrig.situacao === 'Fechado') {
        return NextResponse.json(
          { error: `O caixa de origem (${cxOrig.codigo} - ${cxOrig.descricao}) está Fechado.` },
          { status: 400 }
        )
      }
      if (cxDest && cxDest.situacao === 'Fechado') {
        return NextResponse.json(
          { error: `O caixa de destino (${cxDest.codigo} - ${cxDest.descricao}) está Fechado.` },
          { status: 400 }
        )
      }

      const origCodigo = cxOrig?.codigo || caixaOrigemId
      const origDesc = cxOrig?.descricao || caixaOrigemId
      const destCodigo = cxDest?.codigo || caixaDestinoId
      const destDesc = cxDest?.descricao || caixaDestinoId

      const codBase = nextCodigoLcto()
      const idSaida = `MOV-TRF-S-${Date.now()}`
      const idEntrada = `MOV-TRF-E-${Date.now() + 1}`

      const movSaida: MovimentacaoCaixaRecord = {
        id: idSaida,
        codigoLcto: codBase,
        caixaId: cxOrig?.id || caixaOrigemId,
        caixaCodigo: origCodigo,
        caixaDescricao: origDesc,
        dataLcto: dataTransferencia,
        emissaoDocto: dataTransferencia,
        tipoOperacao: 'Pagamento',
        tipoTransacao: 'Transferência',
        categoriaOrigem: 'transf_valores',
        fornecedorId: cxDest?.codigo || 'TRF',
        fornecedorNome: `Caixa ${destCodigo} - ${destDesc}`,
        descricao: `Transf. enviada p/ Caixa ${destCodigo} (${destDesc})${observacao ? ` — ${observacao}` : ''}`,
        valor,
        valorLiquido: valor,
        contaPlanoId,
        contaPlanoLabel,
        centroCusto,
        tipoDocumento: 'TRF',
        numeroDocumento,
        tipoRecurso,
        compensadoBanco: 'Sim',
        observacao,
        operador,
        transferenciaParId: idEntrada,
        caixaTransferenciaRelacionado: `${destCodigo} - ${destDesc}`,
        createdAt: nowISO,
        updatedAt: nowISO,
        historico: [
          {
            id: `hist-trf-s-${Date.now()}`,
            data: nowISO,
            acao: 'Saída por Transferência entre Caixas',
            usuario: operador,
            detalhes: `Transferido R$ ${valor.toFixed(2)} do Caixa ${origCodigo} para Caixa ${destCodigo} via ${tipoRecurso}.`,
          },
        ],
      }

      const movEntrada: MovimentacaoCaixaRecord = {
        id: idEntrada,
        codigoLcto: codBase + 1,
        caixaId: cxDest?.id || caixaDestinoId,
        caixaCodigo: destCodigo,
        caixaDescricao: destDesc,
        dataLcto: dataTransferencia,
        emissaoDocto: dataTransferencia,
        tipoOperacao: 'Recebimento',
        tipoTransacao: 'Transferência',
        categoriaOrigem: 'transf_valores',
        fornecedorId: cxOrig?.codigo || 'TRF',
        fornecedorNome: `Caixa ${origCodigo} - ${origDesc}`,
        descricao: `Transf. recebida do Caixa ${origCodigo} (${origDesc})${observacao ? ` — ${observacao}` : ''}`,
        valor,
        valorLiquido: valor,
        contaPlanoId,
        contaPlanoLabel,
        centroCusto,
        tipoDocumento: 'TRF',
        numeroDocumento,
        tipoRecurso,
        compensadoBanco: 'Sim',
        observacao,
        operador,
        transferenciaParId: idSaida,
        caixaTransferenciaRelacionado: `${origCodigo} - ${origDesc}`,
        createdAt: nowISO,
        updatedAt: nowISO,
        historico: [
          {
            id: `hist-trf-e-${Date.now()}`,
            data: nowISO,
            acao: 'Entrada por Transferência entre Caixas',
            usuario: operador,
            detalhes: `Recebido R$ ${valor.toFixed(2)} do Caixa ${origCodigo} no Caixa ${destCodigo} via ${tipoRecurso}.`,
          },
        ],
      }

      movsManuais.unshift(movEntrada, movSaida)

      const vaiZerarOrigem =
        saldoOrigemAtual !== undefined ? Math.abs(saldoOrigemAtual - valor) < 0.01 : false
      const deveFecharOrigem = fecharCaixaOrigemAposTransferencia && vaiZerarOrigem

      // Atualiza histórico e saldos dos caixas em cfgCaixas
      caixas = caixas.map((c) => {
        if (c.id === cxOrig?.id) {
          const descSaida = `Saída de R$ ${valor.toFixed(2)} transferida para Caixa ${destCodigo} - ${destDesc}.${observacao ? ` (${observacao})` : ''}`
          const histEntries: any[] = [
            {
              id: `HCX-TRF-${Date.now()}-S`,
              dataHora: nowISO,
              acao: 'Transferência Enviada',
              usuario: operador,
              valorEnvolvido: valor,
              detalhes: descSaida,
              observacao: descSaida,
            },
          ]
          if (deveFecharOrigem) {
            const descFech = `Caixa fechado automaticamente após transferência total do saldo positivo (R$ ${valor.toFixed(2)}) para Caixa ${destCodigo}.`
            histEntries.unshift({
              id: `HCX-FCH-${Date.now()}`,
              dataHora: nowISO,
              acao: 'Fechamento de Caixa (Saldo Zerado)',
              usuario: operador,
              valorEnvolvido: 0,
              detalhes: descFech,
              observacao: descFech,
            })
          }
          return {
            ...c,
            situacao: deveFecharOrigem ? 'Fechado' : c.situacao,
            dataFechamento: deveFecharOrigem ? hojeStr : c.dataFechamento,
            fechadoPor: deveFecharOrigem ? operador : c.fechadoPor,
            totalSaidas: Number(c.totalSaidas || 0) + valor,
            updatedAt: nowISO,
            historico: [...histEntries, ...(Array.isArray(c.historico) ? c.historico : [])],
          }
        }
        if (c.id === cxDest?.id) {
          const descEntrada = `Entrada de R$ ${valor.toFixed(2)} recebida do Caixa ${origCodigo} - ${origDesc}.${observacao ? ` (${observacao})` : ''}`
          return {
            ...c,
            totalEntradas: Number(c.totalEntradas || 0) + valor,
            updatedAt: nowISO,
            historico: [
              {
                id: `HCX-TRF-${Date.now()}-E`,
                dataHora: nowISO,
                acao: 'Transferência Recebida',
                usuario: operador,
                valorEnvolvido: valor,
                detalhes: descEntrada,
                observacao: descEntrada,
              },
              ...(Array.isArray(c.historico) ? c.historico : []),
            ],
          }
        }
        return c
      })

      await Promise.all([
        admin
          .from('configuracoes')
          .upsert({ chave: CFG_KEY_MOVS_CAIXA, valor: movsManuais, updated_at: nowISO }, { onConflict: 'chave' }),
        admin
          .from('configuracoes')
          .upsert({ chave: 'cfgCaixas', valor: caixas, updated_at: nowISO }, { onConflict: 'chave' }),
      ])

      ;(globalThis as any).configCache?.clear?.()
      return NextResponse.json({
        ok: true,
        movSaida,
        movEntrada,
        caixas,
        movimentacoesManuais: movsManuais,
        caixaOrigemFechado: deveFecharOrigem,
      })
    }

    // 6. FECHAR / REABRIR / CONFERIR CAIXA
    if (action === 'alterar_situacao_caixa') {
      const caixaId = String(body.caixaId || '')
      const novaSituacao = body.novaSituacao as 'Aberto' | 'Fechado' | 'Em Conferência' | undefined
      const detalhes = String(body.detalhes || '')
      const acaoLabel = String(body.acaoLabel || 'Alteração de Situação')
      const saldoInformado = body.saldoInformado !== undefined ? Number(body.saldoInformado) : undefined
      const saldoCalculado =
        body.saldoCalculado !== undefined
          ? Number(body.saldoCalculado)
          : saldoInformado !== undefined
            ? saldoInformado
            : 0

      if (novaSituacao === 'Fechado' && Math.abs(saldoCalculado) >= 0.01) {
        return NextResponse.json(
          {
            error: `Fechamento bloqueado: o caixa possui saldo de R$ ${saldoCalculado.toFixed(2)}. O caixa só pode ser fechado quando estiver totalmente zerado (R$ 0,00).`,
          },
          { status: 400 }
        )
      }

      caixas = caixas.map((c) => {
        if (c.id !== caixaId && c.codigo !== caixaId) return c
        const sit = novaSituacao || c.situacao
        return {
          ...c,
          situacao: sit,
          dataFechamento: sit === 'Fechado' ? hojeStr : sit === 'Aberto' ? '' : c.dataFechamento,
          fechadoPor: sit === 'Fechado' ? operador : sit === 'Aberto' ? '' : c.fechadoPor,
          updatedAt: nowISO,
          historico: [
            {
              id: `HCX-MOV-${Date.now()}`,
              dataHora: nowISO,
              acao: acaoLabel,
              usuario: operador,
              valorEnvolvido: saldoInformado,
              detalhes: detalhes || `Situação do caixa definida para ${sit}.`,
              observacao: detalhes || `Situação do caixa definida para ${sit}.`,
            },
            ...(Array.isArray(c.historico) ? c.historico : []),
          ],
        }
      })

      await admin
        .from('configuracoes')
        .upsert({ chave: 'cfgCaixas', valor: caixas, updated_at: nowISO }, { onConflict: 'chave' })

      ;(globalThis as any).configCache?.clear?.()
      return NextResponse.json({ ok: true, caixas })
    }

    return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao processar operação em Movimentação Financeira' },
      { status: 500 }
    )
  }
}
