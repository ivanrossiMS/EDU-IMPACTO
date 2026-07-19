import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

const EVENTOS_LIVROS = ['livros', 'apostilas em', 'apostilas fund2', 'apostila em', 'apostila fund2', 'apostilas ens. médio', 'liv', 'itinerário', 'itinerario']

function isEventoLivro(descricao?: string): boolean {
  if (!descricao) return false
  const lowerDesc = descricao.toLowerCase()
  return EVENTOS_LIVROS.some(e => lowerDesc.includes(e))
}

const resolverDesc = (raw: any): string => {
  if (raw.evento?.trim()) return raw.evento.trim()
  if (raw.eventoDescricao?.trim()) return raw.eventoDescricao.trim()
  return raw.descricao?.trim() ?? ''
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()

    // Buscamos em paralelo os dados estritamente necessários
    const [resTitulos, resPedidos, resManuais, resAlunos, resTurmas] = await Promise.all([
      supabase.from('titulos').select('id, aluno, eventoDescricao, descricao, valor, dataLancamento, created_at, vencimento'),
      supabase.from('adm_pedidos_livros').select('id, dados'),
      supabase.from('adm_pedidos_livros_manuais').select('id, dados'),
      supabase.from('alunos').select('id, nome, turma'),
      supabase.from('turmas').select('id, codigo, nome')
    ])

    const titulos = resTitulos.data || []
    
    // Mapeia os pedidos da tabela de meta-dados
    const pedidosMeta = (resPedidos.data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    
    // Mapeia os pedidos manuais
    const pedidosManuais = (resManuais.data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    
    const alunos = resAlunos.data || []
    const turmas = resTurmas.data || []

    // HashMaps para O(1) Lookups
    const turmasMap = new Map()
    for (const t of turmas) {
      turmasMap.set(t.id, t)
      if (t.codigo) turmasMap.set(t.codigo, t)
    }

    const alunosMapByNome = new Map()
    const alunosMapById = new Map()
    for (const a of alunos) {
      alunosMapByNome.set(a.nome, a)
      alunosMapById.set(a.id, a)
    }

    const pedidosMetaMap = new Map()
    for (const p of pedidosMeta) {
      if (p.tituloId) pedidosMetaMap.set(p.tituloId, p)
    }

    // Filtra parcelas dos Títulos que são livros
    const parcelasDeTitulos: any[] = []
    for (const t of titulos) {
      const desc = resolverDesc({ eventoDescricao: t.eventoDescricao, descricao: t.descricao })
      if (!isEventoLivro(desc)) continue

      const matchingAluno = alunosMapByNome.get(t.aluno)
      let turmaNome = 'S/T'
      
      if (matchingAluno) {
        const tObj = turmasMap.get(matchingAluno.turma)
        turmaNome = tObj?.nome || matchingAluno.turma || 'S/T'
      }

      parcelasDeTitulos.push({
        id: t.id,
        aluno: t.aluno,
        alunoId: matchingAluno?.id,
        turma: turmaNome,
        eventoDescricao: desc,
        valor: t.valor || 0,
        dataLancamento: t.dataLancamento,
        created_at: t.created_at,
        vencimento: t.vencimento
      })
    }

    const todasParcelas = [...parcelasDeTitulos, ...pedidosManuais]

    const mapOrders = new Map<string, any>()
    let totalValue = 0, entregueCount = 0, preparadoCount = 0, pendenteCount = 0

    // Otimização do agrupamento e atribuição de turmas
    for (const p of todasParcelas) {
      const key = `${p.aluno}__${p.eventoDescricao}`
      const pMeta = pedidosMetaMap.get(p.id)
      
      let finalTurma = p.turma
      if (!finalTurma || finalTurma === 'S/T' || finalTurma === '—') {
        const matchingAluno = alunosMapByNome.get(p.aluno) || alunosMapById.get(p.alunoId)
        if (matchingAluno) {
          const tObj = turmasMap.get(matchingAluno.turma)
          finalTurma = tObj?.nome || matchingAluno.turma || 'S/T'
        }
      }

      if (!mapOrders.has(key)) {
        mapOrders.set(key, { 
          id: p.id, 
          aluno: p.aluno, 
          turma: finalTurma || 'S/T', 
          material: p.eventoDescricao, 
          valor: 0, 
          feito: pMeta?.feito ?? false, 
          entregue: pMeta?.entregue ?? false,
          timestamp: new Date(p.dataLancamento || p.created_at || p.vencimento || 0).getTime() 
        })
      } else {
        const existing = mapOrders.get(key)
        if (pMeta?.feito) existing.feito = true
        if (pMeta?.entregue) existing.entregue = true
        if (finalTurma && (!existing.turma || existing.turma === 'S/T' || existing.turma === '—')) {
          existing.turma = finalTurma
        }
      }
      
      const val = Number(p.valor) || 0
      mapOrders.get(key).valor += val
      totalValue += val
    }

    const uniqueOrders = Array.from(mapOrders.values())
    for (const o of uniqueOrders) {
      if (o.entregue) entregueCount++
      else if (o.feito) preparadoCount++
      else pendenteCount++
    }

    const sortedOrders = uniqueOrders.sort((a, b) => b.timestamp - a.timestamp)
    const recentOrders = sortedOrders.slice(0, 4)

    return NextResponse.json({
      totalOrders: uniqueOrders.length,
      totalValue,
      entregueCount,
      preparadoCount,
      pendenteCount,
      recentOrders
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
    })
  } catch (err: any) {
    console.error('Error fetching pedidos-summary:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
