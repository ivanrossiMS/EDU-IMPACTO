// lib/financialReports.ts

export interface DemonstracaoRawRow {
  id: string
  origem: 'titulo' | 'conta_pagar' | 'movimentacao'
  tipo: 'receita' | 'despesa'
  descricao: string
  planoContasId: string
  valorEsperado: number
  valorPago: number
  dataCompetencia: string
  dataVencimento: string
  dataPagamento: string | null
  status: string
  alunoResponsavel: string
  formaPagamento: string | null
  documento: string
}

export type VisionMode = 'mensal' | 'trimestral' | 'anual'
export type DateBase = 'competencia' | 'vencimento' | 'pagamento'

export interface DemNode {
  id: string; // planoId
  codPlano: string;
  descricao: string;
  tipo: 'analitico' | 'sintetico' | 'detalhe';
  grupoConta: 'receitas' | 'despesas' | 'investimentos';
  parentId: string;
  
  // Agregações
  quantidade: number;
  total: number;
  
  // Colunas Extras para Anual (ex: jan=100, fev=200) ou Trimestres
  totaisPeriodos: Record<string, { total: number, qtd: number }>;
  
  // Nós Filhos
  children: DemNode[];
  
  // Lançamentos anexos (para drill down apenas em analíticos)
  rows: DemonstracaoRawRow[];
}

import { ConfigPlanoContas } from '@/lib/dataContext'

export function buildDemonstracaoTree(
  rows: DemonstracaoRawRow[],
  planos: ConfigPlanoContas[],
  base: DateBase,
  mode: VisionMode,
  mesAnoSelecionado?: string, // YYYY-MM
  anoSelecionado?: number,
  trimestreSelecionado?: number // 1,2,3,4
): DemNode[] {
  
  // 1. Filtrar as Rows pela data-base do Relatório (Ex: filtrar só o Ano, ou Mês)
  // A API Backend fará um pré-filtro maior, aqui afinamos o que será exibido (Local Cross-filter).
  const validRows = rows.filter(r => {
    let d = r.dataVencimento
    if (base === 'competencia') d = r.dataCompetencia || r.dataVencimento
    if (base === 'pagamento') d = r.dataPagamento || ''
    
    if (!d) return false

    // Parsing Date
    const yr = parseInt(d.substring(0, 4))
    const mo = parseInt(d.substring(5, 7)) // 1 a 12

    if (mode === 'anual') {
      if (anoSelecionado && yr !== anoSelecionado) return false
    } else if (mode === 'trimestral') {
      if (anoSelecionado && yr !== anoSelecionado) return false
      if (trimestreSelecionado) {
        const trimes = Math.ceil(mo / 3)
        if (trimes !== trimestreSelecionado) return false
      }
    } else if (mode === 'mensal') {
      if (mesAnoSelecionado && d.substring(0, 7) !== mesAnoSelecionado) return false
    }

    return true
  })

  // 2. Inicializar Mapa O(1) de Planos
  const nodeMap = new Map<string, DemNode>()
  planos.forEach(p => {
    nodeMap.set(p.id, {
      id: p.id,
      codPlano: p.codPlano,
      descricao: p.descricao,
      tipo: p.tipo,
      grupoConta: p.grupoConta,
      parentId: p.parentId || '',
      quantidade: 0,
      total: 0,
      totaisPeriodos: {},
      children: [],
      rows: []
    })
  })

  // Nó fantasma para itens não mapeados
  const UNMAPPED = 'UNMAPPED'
  nodeMap.set(UNMAPPED, {
    id: UNMAPPED, codPlano: '99', descricao: 'Sem Plano de Contas', tipo: 'sintetico',
    grupoConta: 'despesas', parentId: '', quantidade: 0, total: 0, totaisPeriodos: {}, children: [], rows: []
  })

  // Helper p/ formatar chaves de coluna temporal
  const getColKey = (d: string) => {
    if (mode === 'anual') return d.substring(5, 7) // '01', '02'...
    if (mode === 'trimestral') {
       const mo = parseInt(d.substring(5, 7))
       return mo.toString() // '1', '2', '3' dependendo do trimestre
    }
    return 'current' // mensal
  }

  // 3. Destinar Rows para seus nós Analíticos
  validRows.forEach(r => {
    let d = r.dataVencimento
    if (base === 'competencia') d = r.dataCompetencia || r.dataVencimento
    if (base === 'pagamento') d = r.dataPagamento || ''
    
    const pid = r.planoContasId && nodeMap.has(r.planoContasId) ? r.planoContasId : UNMAPPED
    const node = nodeMap.get(pid)!
    
    // Valor sendo calculado
    const v = r.status === 'cancelado' ? 0 : (base === 'pagamento' ? r.valorPago : r.valorEsperado)
    
    node.rows.push(r)
    node.quantidade++
    node.total += v

    const cKey = getColKey(d)
    if (!node.totaisPeriodos[cKey]) node.totaisPeriodos[cKey] = { total: 0, qtd: 0 }
    node.totaisPeriodos[cKey].total += v
    node.totaisPeriodos[cKey].qtd++
  })

  // 4. Rollup (Sintéticos agrupando Analíticos) Bottom-up
  // Ordena plano reverso (profundos primeiro: ex 1.1.1.1 antes de 1.1)
  const sortedPlanos = Array.from(nodeMap.values()).sort((a,b) => b.codPlano.length - a.codPlano.length)

  // Bubble up values
  for (const n of sortedPlanos) {
    if (n.parentId && nodeMap.has(n.parentId)) {
      const parent = nodeMap.get(n.parentId)!
      parent.quantidade += n.quantidade
      parent.total += n.total
      
      // Rollup Periods
      for (const k in n.totaisPeriodos) {
        if (!parent.totaisPeriodos[k]) parent.totaisPeriodos[k] = { total:0, qtd:0 }
        parent.totaisPeriodos[k].total += n.totaisPeriodos[k].total
        parent.totaisPeriodos[k].qtd += n.totaisPeriodos[k].qtd
      }
    }
  }

  // 5. Montar a Árvore
  const roots: DemNode[] = []
  
  // Limpar filhos pra evitar duplicação em React useMemo triggers
  nodeMap.forEach(n => n.children = [])

  // Ordernar p/ montagem top-down
  const ascNodes = Array.from(nodeMap.values()).sort((a,b) => a.codPlano.localeCompare(b.codPlano))
  ascNodes.forEach(n => {
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId)!.children.push(n)
    } else {
      roots.push(n)
    }
  })

  // 6. Retirar da raiz os PurosZeros (árvores vazias) para otimizar visualização, exceto se explícito
  const prune = (nodes: DemNode[]): DemNode[] => {
    const keep: DemNode[] = []
    for (const n of nodes) {
      n.children = prune(n.children)
      if (n.total !== 0 || n.quantidade > 0 || n.children.length > 0) {
        keep.push(n)
      }
    }
    return keep
  }

  return prune(roots)
}
