import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const {
      dataInicio,
      dataFim,
      contaInicial,   // codPlano como string ex: "00.01"
      contaFinal,     // codPlano como string ex: "00.01.12"
      tipo,           // 'receita' | 'despesa' | ''
      grupoConta,     // 'receitas' | 'despesas' | 'investimentos' | ''
      busca,
      centroCustoId,
      status,
      formaPagamento,
      origem,
    } = await req.json()

    // ── 1. Configurações (plano + centros + eventos) ─────────────────────────
    const { data: cfgRows } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['cfgPlanoContas', 'cfgCentrosCusto', 'cfgEventos'])

    const planoContas: any[] = cfgRows?.find(r => r.chave === 'cfgPlanoContas')?.valor  || []
    const centrosCusto: any[] = cfgRows?.find(r => r.chave === 'cfgCentrosCusto')?.valor || []
    const cfgEventos: any[]  = cfgRows?.find(r => r.chave === 'cfgEventos')?.valor       || []

    // Índices para lookup rápido
    const planoMap: Record<string, any> = {}
    planoContas.forEach(pc => { planoMap[pc.id] = pc })

    // Índice de eventos → planoContasId (para resolver movimentações sem plano)
    const eventoByIdMap: Record<string, string>   = {}
    const eventoByNomeMap: Record<string, string> = {}
    for (const ev of cfgEventos) {
      if (ev.id && ev.planoContasId)        eventoByIdMap[ev.id] = ev.planoContasId
      if (ev.descricao && ev.planoContasId) eventoByNomeMap[ev.descricao.trim().toLowerCase()] = ev.planoContasId
    }

    // ── 2. Filtrar plano de contas pelo range codPlano ───────────────────────
    let contasFiltradas = planoContas
    if (contaInicial || contaFinal) {
      contasFiltradas = planoContas.filter(pc => {
        if (contaInicial && pc.codPlano < contaInicial) return false
        if (contaFinal   && pc.codPlano > contaFinal)   return false
        return true
      })
    }
    if (grupoConta) {
      contasFiltradas = contasFiltradas.filter(pc => pc.grupoConta === grupoConta)
    }

    // ── 3. Buscar movimentações ──────────────────────────────────────────────
    let query = supabase
      .from('movimentacoes')
      .select('*')
      .order('data', { ascending: true })

    if (dataInicio) query = query.gte('data', dataInicio)
    if (dataFim)    query = query.lte('data', dataFim)
    if (tipo && tipo !== '') query = query.eq('tipo', tipo)
    if (centroCustoId)       query = query.eq('centro_custo_id', centroCustoId)
    if (status && status !== '') query = query.eq('status', status)

    const { data: movs, error } = await query
    if (error) throw error

    // ── 4. Enrich cada movimentação ──────────────────────────────────────────
    const fmtDate = (s: string) => {
      if (!s) return ''
      const clean = s.length > 10 ? s.slice(0, 10) : s
      const [y, m, d] = clean.split('-')
      if (!y || !m || !d) return s
      return `${d}/${m}/${y}`
    }

    const allMovs = (movs || []).map(m => {
      const dados = (m.dados || {}) as any

      // ── Auto-resolver plano_contas_id se não preenchido ───────────────────
      let resolvedPlanoId: string = m.plano_contas_id || ''
      if (!resolvedPlanoId && dados.eventoId)
        resolvedPlanoId = eventoByIdMap[dados.eventoId] || ''
      if (!resolvedPlanoId && dados.eventoNome)
        resolvedPlanoId = eventoByNomeMap[(dados.eventoNome as string).trim().toLowerCase()] || ''
      // fallback por nome do evento na descrição (ex: "Baixa Parcela 01 — Mensalidade - INF (aluno...)")
      if (!resolvedPlanoId && m.descricao) {
        // extrai o nome do evento entre "—" e "(aluno"
        const match = m.descricao.match(/—\s*(.+?)\s*\(/)
        if (match) {
          const eventoNomeInDesc = match[1].trim().toLowerCase()
          resolvedPlanoId = eventoByNomeMap[eventoNomeInDesc] || ''
        }
      }

      const conta = resolvedPlanoId ? planoMap[resolvedPlanoId] : null
      const cc    = m.centro_custo_id ? centrosCusto.find(c => c.id === m.centro_custo_id) : null

      const isReceita = m.tipo === 'receita' || m.tipo === 'entrada'

      return {
        id:             m.id,
        data:           m.data || '',
        dataFmt:        fmtDate(m.data || ''),
        descricao:      m.descricao || dados.descricao || '',
        tipo:           m.tipo || '',
        valor:          Number(m.valor) || 0,
        credito:        isReceita ? Number(m.valor) || 0 : 0,
        debito:         !isReceita ? Number(m.valor) || 0 : 0,
        status:         m.status || dados.status || 'ativo',
        // Plano de contas (pode ter sido resolvido retroativamente)
        planoContasId:  resolvedPlanoId,
        codPlano:       conta?.codPlano || '',
        contaDescricao: conta?.descricao || 'Sem Plano de Contas',
        grupoConta:     conta?.grupoConta || m.tipo || '',
        tipoContabil:   conta?.tipo || '',
        naturezaDRE:    conta?.naturezaDRE || '',
        grupoDRE:       conta?.grupoDRE || '',
        // Centro de custo
        centroCustoId:  m.centro_custo_id || '',
        centroCusto:    cc?.descricao || '',
        // JSONB dados
        formaPagamento:  dados.forma_pagamento || dados.formaPagamento || '',
        numeroDocumento: dados.numeroDocumento || dados.numero_documento || '',
        tipoDocumento:   dados.tipoDocumento   || dados.tipo_documento   || '',
        referenciaId:    dados.referenciaId    || dados.referencia_id    || '',
        origem:          dados.origem   || '',
        operador:        dados.operador || '',
        nomeAluno:       dados.nomeAluno || '',
        observacoes:     dados.observacoes || '',
        dataMovimento:   dados.dataMovimento ? fmtDate(dados.dataMovimento) : '',
        dataLancamento:  dados.dataLancamento ? fmtDate(dados.dataLancamento) : '',
      }
    })

    // ── 5. Aplicar filtros client-side ───────────────────────────────────────
    let filtered = allMovs

    // Filtro por range de contas
    if (contaInicial || contaFinal) {
      const contaIds = new Set(contasFiltradas.map(c => c.id))
      filtered = filtered.filter(m => m.planoContasId && contaIds.has(m.planoContasId))
    }
    if (grupoConta) {
      filtered = filtered.filter(m => m.grupoConta === grupoConta)
    }
    if (busca) {
      const q = busca.toLowerCase()
      filtered = filtered.filter(m =>
        m.descricao.toLowerCase().includes(q) ||
        m.contaDescricao.toLowerCase().includes(q) ||
        m.codPlano.includes(q) ||
        m.nomeAluno.toLowerCase().includes(q) ||
        m.numeroDocumento.toLowerCase().includes(q) ||
        m.origem.toLowerCase().includes(q)
      )
    }
    if (formaPagamento) filtered = filtered.filter(m => m.formaPagamento === formaPagamento)
    if (origem)         filtered = filtered.filter(m => m.origem === origem)

    // ── 6. Montar Razão agrupado por conta ───────────────────────────────────
    const razaoMap: Record<string, {
      conta: any
      lancamentos: typeof filtered
      totalCredito: number
      totalDebito:  number
      saldo:        number
    }> = {}

    filtered.forEach(m => {
      const key = m.planoContasId || '__sem_conta__'
      if (!razaoMap[key]) {
        razaoMap[key] = {
          conta: {
            id:           m.planoContasId,
            codPlano:     m.codPlano,
            descricao:    m.contaDescricao,
            grupoConta:   m.grupoConta,
            naturezaDRE:  m.naturezaDRE,
            grupoDRE:     m.grupoDRE,
            tipoContabil: m.tipoContabil,
          },
          lancamentos:  [],
          totalCredito: 0,
          totalDebito:  0,
          saldo:        0,
        }
      }
      razaoMap[key].lancamentos.push(m)
      razaoMap[key].totalCredito += m.credito
      razaoMap[key].totalDebito  += m.debito
    })

    // Calcular saldo respeitando natureza contábil
    Object.values(razaoMap).forEach(r => {
      const nat = r.conta.naturezaDRE || 'neutra'
      if (nat === 'credora')  r.saldo = r.totalCredito - r.totalDebito
      else if (nat === 'devedora') r.saldo = r.totalDebito - r.totalCredito
      else r.saldo = r.totalCredito - r.totalDebito
    })

    const razaoEntries = Object.values(razaoMap).sort((a, b) => {
      const ca = a.conta.codPlano || 'zzz'
      const cb = b.conta.codPlano || 'zzz'
      return ca.localeCompare(cb)
    })

    // ── 7. Totalizadores globais ─────────────────────────────────────────────
    const totalGlobalCredito = filtered.reduce((s, m) => s + m.credito, 0)
    const totalGlobalDebito  = filtered.reduce((s, m) => s + m.debito,  0)

    return NextResponse.json({
      ok:    true,
      razao: razaoEntries,
      totais: {
        credito:     totalGlobalCredito,
        debito:      totalGlobalDebito,
        saldo:       totalGlobalCredito - totalGlobalDebito,
        lancamentos: filtered.length,
        contas:      razaoEntries.length,
      },
      listaFlat:   filtered,
      planoContas: planoContas,  // lista completa para os selects
      centrosCusto,
    })
  } catch (err: any) {
    console.error('[razao-contas]', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
