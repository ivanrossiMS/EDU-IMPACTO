import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Converte data DD/MM/YYYY → YYYY-MM-DD (ISO).
 * Parcelas dos alunos são salvas em formato pt-BR.
 */
function brDateToISO(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.substring(0, 10) // já é ISO, normaliza
  const parts = d.split('/')
  if (parts.length !== 3) return ''
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('inicio')
    const dataFim    = searchParams.get('fim')
    const por        = searchParams.get('por') || 'vencimento'

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'Parâmetros dataInicio e dataFim são obrigatórios' }, { status: 400 })
    }

    // ── 1. cfgEventos → mapa evento → planoContasId ─────────────────────────
    const { data: configData } = await supabase
      .from('configuracoes').select('valor').eq('chave', 'cfgEventos').single()

    const eventos = configData?.valor || []
    const eventoPlanoMap: Record<string, string> = {}
    const eventoDescMap:  Record<string, string> = {}

    ;(eventos || []).forEach((e: any) => {
      const pid = e.planoContasId || e.plano_contas_id ||
        (e.dados && (e.dados.planoContasId || e.dados.plano_contas_id)) || ''
      if (pid) {
        if (e.id)       eventoPlanoMap[e.id]                             = pid
        if (e.descricao) eventoDescMap[e.descricao.toLowerCase().trim()] = pid
        if (e.nome)      eventoDescMap[e.nome.toLowerCase().trim()]       = pid
      }
    })

    const resolvePlano = (parsed: any): string => {
      if (parsed.planoContasId)   return parsed.planoContasId
      if (parsed.plano_contas_id) return parsed.plano_contas_id
      const evId = parsed.eventoId || parsed.evento_id || ''
      if (evId && eventoPlanoMap[evId]) return eventoPlanoMap[evId]
      const evDesc = (parsed.eventoDescricao || parsed.evento_descricao || parsed.evento || '').toLowerCase().trim()
      if (evDesc && eventoDescMap[evDesc]) return eventoDescMap[evDesc]
      const desc = (parsed.descricao || '').toLowerCase().trim()
      if (desc && eventoDescMap[desc]) return eventoDescMap[desc]
      for (const [k, pid] of Object.entries(eventoDescMap)) {
        if (desc.includes(k) || k.includes(desc)) return pid
      }
      return ''
    }

    const isInRange = (iso: string) => iso >= dataInicio! && iso <= dataFim!

    // ══════════════════════════════════════════════════════════════════════════
    // DEDUPLICAÇÃO — 4 camadas de proteção
    // ══════════════════════════════════════════════════════════════════════════
    const idsJaVistos = new Set<string>() // Camada A
    const fingerprints_titulos = new Set<string>() // Camada B
    const semanticFingerprints = new Set<string>() // Camada C (A MAIS FORTE)

    const rows: any[] = []

    // Função de push segura com deduplicação SEMÂNTICA e por ID
    const safePush = (row: any) => {
      if (!row.id) return
      
      // Camada A: match exato de ID
      if (idsJaVistos.has(row.id)) return
      
      // Camada C: Deduplicação Semântica (Mesmo valor, data, pessoa, descrição)
      // Resolvemos o problema de IDs gerados diferentes para a mesma entidade.
      // Ex: "receita|José Fernando|Mensalidade - INTEGRAL|107.92|2026-04-10"
      const semFingerprint = `${row.tipo}|${(row.alunoResponsavel||'').trim().toLowerCase()}|${(row.descricao||'').trim().toLowerCase()}|${Number(row.valorEsperado).toFixed(2)}|${row.dataVencimento}`
      
      if (semanticFingerprints.has(semFingerprint)) return // Já temos uma conta exata como esta!

      idsJaVistos.add(row.id)
      semanticFingerprints.add(semFingerprint)
      rows.push(row)
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RESOLUÇÃO DE ID VISUAL DO BOLETO / PARCELA
    // ══════════════════════════════════════════════════════════════════════════
    const eventoDateToBadge = new Map<string, string>()
    const semanticToBadge = new Map<string, string>()

    // Pré-carregamos alunos para injetar o ID exato (eventoId-num) no idOrigem dos Títulos
    const { data: precoAlunos } = await supabase.from('alunos').select('id, nome, responsavel, dados')
    for (const aluno of (precoAlunos || [])) {
      const dados = aluno.dados || {}
      const parcelas: any[] = dados.parcelas || []
      const resp = aluno.nome || dados.nome || dados.nomeAluno || aluno.responsavel || dados.responsavel || dados.nomeResponsavel || dados.responsavelFinanceiro || ''
      
      for (const p of parcelas) {
        const vencISO = brDateToISO(p.vencimento||'')
        if (!vencISO) continue
        
        const fp = `receita|${resp.trim().toLowerCase()}|${(p.evento||p.descricao||'Mensalidade').trim().toLowerCase()}|${Number(p.valorFinal ?? p.valor ?? 0).toFixed(2)}|${vencISO}`
        
        const eparcs = p.eventoId ? parcelas.filter(x => x.eventoId === p.eventoId).sort((a,b)=>new Date(brDateToISO(a.vencimento||'')||'').getTime()-new Date(brDateToISO(b.vencimento||'')||'').getTime()) : null
        const pNum = p.numParcela || (eparcs ? eparcs.findIndex(x=>x.num===p.num)+1 : 1)
        const badge = p.parcelaId || (p.eventoId ? `${p.eventoId}-${String(pNum).padStart(2,'0')}` : null)
        
        if (badge) {
            semanticToBadge.set(fp, badge)
            if (p.eventoId) eventoDateToBadge.set(`${p.eventoId}_${vencISO}`, badge)
        }
      }
    }

    // ── 2. Títulos (Contas a Receber) ─────────────────────────────────────────
    let queryT = supabase.from('titulos').select('*')
    if (por === 'pagamento') {
      queryT = queryT.not('pagamento', 'is', null).gte('pagamento', dataInicio).lte('pagamento', dataFim)
    } else {
      queryT = queryT.gte('vencimento', dataInicio).lte('vencimento', dataFim)
    }
    const { data: titulos } = await queryT

    for (const t of (titulos || [])) {
      const parsed      = { ...t, ...(t.dados || {}) }
      const statusFinal = parsed.status === 'excluido' ? 'cancelado' : parsed.status
      if (statusFinal === 'cancelado') continue

      if (parsed.id)          fingerprints_titulos.add(parsed.id)
      if (parsed.parcelaId)   fingerprints_titulos.add(parsed.parcelaId)
      if (parsed.codigo)      fingerprints_titulos.add(parsed.codigo)
      if (parsed.codBaixa)    fingerprints_titulos.add(parsed.codBaixa)
      if (parsed.nossoNumero) fingerprints_titulos.add(parsed.nossoNumero)

      const vencISOReal = brDateToISO(parsed.vencimento || '')
      const fpForBadge = `receita|${(parsed.aluno || parsed.responsavel || parsed.alunoNome || '').trim().toLowerCase()}|${(parsed.descricao || 'Título').trim().toLowerCase()}|${Number(parsed.valor).toFixed(2)}|${vencISOReal}`
      
      let realIdOrigem = null

      // Match 1: eventoId + Data Exata (MUITO mais seguro)
      if (parsed.eventoId && vencISOReal) {
          const key = `${parsed.eventoId}_${vencISOReal}`
          if (eventoDateToBadge.has(key)) realIdOrigem = eventoDateToBadge.get(key)
      }

      // Match 2: Fallback Semântico 
      if (!realIdOrigem && semanticToBadge.has(fpForBadge)) {
          realIdOrigem = semanticToBadge.get(fpForBadge)
      }

      realIdOrigem = realIdOrigem 
                  || parsed.parcelaId 
                  || (parsed.eventoId && parsed.num ? `${parsed.eventoId}-${String(parsed.num).padStart(2,'0')}` : null) 
                  || parsed.id

      safePush({
        id:               parsed.id,
        origem:           'titulo',
        tipo:             'receita',
        descricao:        parsed.descricao || 'Título',
        planoContasId:    resolvePlano(parsed),
        valorEsperado:    Number(parsed.valor),
        valorPago:        statusFinal === 'pago'
          ? Number(parsed.valor) - Number(parsed.desconto||0) + Number(parsed.multa||0) + Number(parsed.juros||0)
          : 0,
        dataCompetencia:  parsed.vencimento,
        dataVencimento:   parsed.vencimento,
        dataPagamento:    parsed.pagamento || null,
        status:           statusFinal,
        alunoResponsavel: parsed.aluno || parsed.responsavel || parsed.alunoNome || '',
        formaPagamento:   parsed.metodo || parsed.formaPagamento || null,
        documento:        parsed.nossoNumero || parsed.numeroDocumento || '',
        idOrigem:         realIdOrigem
      })
    }

    // ── 3. Contas a Pagar ─────────────────────────────────────────────────────
    const { data: pagar } = await supabase.from('contas_pagar').select('*')
      .gte('vencimento', dataInicio).lte('vencimento', dataFim)

    for (const p of (pagar || [])) {
      const parsed      = { ...p, ...(p.dados || {}) }
      const statusFinal = parsed.status
      if (statusFinal === 'cancelado') continue

      safePush({
        id:               parsed.id,
        origem:           'conta_pagar',
        tipo:             'despesa',
        descricao:        parsed.descricao || 'Despesa',
        planoContasId:    resolvePlano(parsed),
        valorEsperado:    Number(parsed.valor),
        valorPago:        statusFinal === 'pago' ? Number(parsed.valor) : 0,
        dataCompetencia:  parsed.vencimento,
        dataVencimento:   parsed.vencimento,
        dataPagamento:    statusFinal === 'pago' ? (parsed.dataPagamento || parsed.vencimento) : null,
        status:           statusFinal,
        alunoResponsavel: parsed.fornecedor || parsed.fornecedorNome || '',
        formaPagamento:   parsed.formaPagamento || null,
        documento:        parsed.numeroDocumento || '',
        idOrigem:         parsed.id
      })
    }

    // ── 4. Movimentações Manuais (Caixa — baixas efetivadas) ──────────────────
    const { data: movs } = await supabase.from('movimentacoes').select('*')
      .gte('data', dataInicio).lte('data', dataFim)

    const codBaixasEmMovs = new Set<string>()
    for (const m of (movs || [])) {
      const parsed = { ...m, ...(m.dados || {}) }
      const rid = parsed.referenciaId || parsed.codBaixa || ''
      if (rid) codBaixasEmMovs.add(rid)
    }

    for (const m of (movs || [])) {
      const parsed = { ...m, ...(m.dados || {}) }
      // IGNORA movimentacoes geradas por baixas de titulos/contas, pois os próprios títulos
      // já estão computados na Demonstração como 'pago'. Computá-los de novo causaria duplicidade (Receita Dupla).
      if (['baixa_receber', 'baixa_pagar', 'baixa_aluno'].includes(parsed.origem)) continue
      if (parsed.referenciaId && parsed.origem !== 'manual') continue

      const fTipo = (parsed.tipo === 'receita' || parsed.tipo === 'entrada') ? 'receita' : 'despesa'
      const nomeParenteses = (parsed.descricao || '').match(/\(([^)]+)\)$/)?.[1] || ''
      safePush({
        id:               parsed.id,
        origem:           'movimentacao',
        tipo:             fTipo,
        descricao:        parsed.descricao || 'Movimentação',
        planoContasId:    resolvePlano(parsed),
        valorEsperado:    Number(parsed.valor),
        valorPago:        Number(parsed.valor),
        dataCompetencia:  parsed.data || parsed.dataMovimento,
        dataVencimento:   parsed.data || parsed.dataMovimento,
        dataPagamento:    parsed.data || parsed.dataMovimento,
        status:           'pago',
        alunoResponsavel: parsed.fornecedorNome || parsed.aluno || parsed.nomeAluno || nomeParenteses || '',
        formaPagamento:   parsed.formaPagamento || parsed.metodo || null,
        documento:        parsed.numeroDocumento || parsed.tipoDocumento || '',
        idOrigem:         parsed.id
      })
    }

    // ── 5. Parcelas dos Alunos (aluno.dados.parcelas) ─────────────────────────
    const { data: alunos } = await supabase
      .from('alunos')
      .select('id, nome, responsavel, dados')

    for (const aluno of (alunos || [])) {
      const dados    = aluno.dados || {}
      const parcelas: any[] = dados.parcelas || []

      const nomeAluno =
        aluno.nome      ||
        dados.nome      ||
        dados.nomeAluno ||
        dados.nomeCompleto || ''

      const nomeResponsavel =
        aluno.responsavel          ||
        dados.responsavel          ||
        dados.nomeResponsavel      ||
        dados.responsavelFinanceiro || ''

      for (const p of parcelas) {
        const st = p.status || 'pendente'
        if (st === 'cancelado' || st === 'excluido') continue

        if (st === 'pago' && p.codBaixa && codBaixasEmMovs.has(p.codBaixa)) continue

        const candidates = [p.parcelaId, p.codigo, p.codBaixa, p.id].filter(Boolean)
        if (candidates.some(c => fingerprints_titulos.has(c))) continue

        const vencISO = brDateToISO(p.vencimento || '')
        if (!vencISO) continue

        if (por === 'pagamento') {
          const dtPagISO = brDateToISO(p.dtPagto || '')
          if (!dtPagISO || !isInRange(dtPagISO)) continue
        } else {
          if (!isInRange(vencISO)) continue
        }

        const uid = p.parcelaId || `${aluno.id}-p${p.num}-${p.evento || 'ms'}`
        const parteRelacionada = nomeAluno || nomeResponsavel || ''

        safePush({
          id:               uid,
          origem:           'titulo',
          tipo:             'receita',
          descricao:        p.evento || p.descricao || 'Mensalidade',
          planoContasId:    resolvePlano(p),
          valorEsperado:    Number(p.valorFinal ?? p.valor ?? 0),
          valorPago:        st === 'pago'
            ? Number(p.valorFinal ?? p.valor ?? 0) + Number(p.juros || 0) + Number(p.multa || 0) - Number(p.desconto || 0)
            : 0,
          dataCompetencia:  vencISO,
          dataVencimento:   vencISO,
          dataPagamento:    st === 'pago' ? (brDateToISO(p.dtPagto || '') || vencISO) : null,
          status:           st === 'vencido' ? 'pendente' : st,
          alunoResponsavel: parteRelacionada,
          formaPagamento:   p.formaPagto || null,
          documento:        p.codigo || p.codBaixa || '',
          idOrigem:         (p.eventoId && vencISO && eventoDateToBadge.has(`${p.eventoId}_${vencISO}`))
                              ? eventoDateToBadge.get(`${p.eventoId}_${vencISO}`)
                              : (p.parcelaId 
                                 || (p.eventoId && p.numParcela ? `${p.eventoId}-${String(p.numParcela).padStart(2,'0')}` : null)
                                 || p.id || p.codigo || uid)
        })
      }
    }

    return NextResponse.json({
      success: true,
      rows,
      debug: {
        total:           rows.length,
        titulos:         titulos?.length    || 0,
        pagar:           pagar?.length      || 0,
        movimentacoes:   movs?.length       || 0,
        fingerprintSize: fingerprints_titulos.size,
        semanticBlocks:  semanticFingerprints.size,
      }
    })
  } catch (error: any) {
    console.error('Erro /api/relatorios/demonstracao:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
