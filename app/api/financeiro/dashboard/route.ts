import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

function getMonthLabel(key: string) {
  const [y, m] = key.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m) - 1]}/${y.slice(2)}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') // formato YYYY-MM
    const mesPrev = searchParams.get('mesPrev')

    if (!mes || !mesPrev) {
      return NextResponse.json({ error: 'mes and mesPrev are required' }, { status: 400 })
    }

    const supabase = await createProtectedClient()

    // Parse the date manually to avoid timezone shift from UTC parsing
    const [yStr, mStr] = mes.split('-')
    const yearNum = parseInt(yStr, 10)
    const monthIndex = parseInt(mStr, 10) - 1 // 0-indexed

    // Gera os 6 últimos meses para o gráfico
    const last6Months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(yearNum, monthIndex - i, 1)
      last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const chartStartMonth = last6Months[0]

    // Todas as queries em paralelo via Promise.all — reduz latência total
    const [
      resNovasMatriculas,
      resAlunosAll, resFuncionarios, resTurmas,
      resChartReceita, resChartDespesa, resDespesasCat
    ] = await Promise.all([
      supabase.from('alunos').select('id', { count: 'exact', head: true })
        .eq('status', 'matriculado')
        .gte('created_at', `${mes}-01`)
        .lt('created_at', `${monthIndex === 11 ? yearNum + 1 : yearNum}-${String((monthIndex === 11 ? 0 : monthIndex + 1) + 1).padStart(2, '0')}-01`),
      supabase.from('alunos').select('id, status, dados, risco_evasao'),
      supabase.from('funcionarios').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
      supabase.from('turmas').select('capacidade, matriculados'),
      supabase.from('titulos').select('valor, pagamento').eq('status', 'pago').gte('pagamento', `${chartStartMonth}-01`),
      supabase.from('contas_pagar').select('valor, vencimento').in('status', ['pago', 'pendente', 'atrasado']).gte('vencimento', `${chartStartMonth}-01`),
      supabase.from('contas_pagar').select('valor, categoria').in('status', ['pago', 'pendente', 'atrasado']).ilike('vencimento', `${mes}%`)
    ])

    const alunosVal = resAlunosAll.data ?? []
    
    let totalAlunos = 0
    let inadimplentes = 0
    let riscoAlto = 0
    let riscoMedio = 0
    let riscoBaixo = 0

    let receitaMes = 0
    let receitaPrev = 0
    const recMap: Record<string, number> = {}

    // 1. Process avulso Titulos
    for (const t of (resChartReceita.data ?? [])) {
      const k = (t.pagamento as string)?.slice(0, 7)
      if (k) {
        recMap[k] = (recMap[k] ?? 0) + (Number(t.valor) || 0)
        if (k === mes) receitaMes += (Number(t.valor) || 0)
        if (k === mesPrev) receitaPrev += (Number(t.valor) || 0)
      }
    }

    const hojeStart = new Date()
    hojeStart.setHours(0, 0, 0, 0)

    // 2. Process Alunos (Active status, Risco, Inadimplencia, and Parcelas Paid)
    for (const a of alunosVal) {
      if (a.status === 'matriculado') {
        totalAlunos++
        if (a.risco_evasao === 'alto') riscoAlto++
        else if (a.risco_evasao === 'medio') riscoMedio++
        else if (a.risco_evasao === 'baixo') riscoBaixo++

        const pacs = a.dados?.parcelas || []
        const hasOverdue = pacs.some((p: any) => {
          if (p.status === 'pendente' && p.vencimento) {
            let dt: Date | null = null
            if (p.vencimento.includes('/')) {
              const [dd, mm, yyyy] = p.vencimento.split('/')
              dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`)
            } else {
              dt = new Date(`${p.vencimento}T12:00:00Z`)
            }
            return dt && (dt.getTime() < hojeStart.getTime())
          }
          return false
        })
        if (hasOverdue) inadimplentes++
      }

      // Receita das parcelas do jsonb
      const pacs = a.dados?.parcelas || []
      for (const p of pacs) {
        if (p.status === 'pago' && p.dtPagto) {
          let k = ''
          if (p.dtPagto.includes('/')) {
            const [dd, mm, yyyy] = p.dtPagto.split('/')
            k = `${yyyy}-${mm}`
          } else {
            k = p.dtPagto.slice(0, 7)
          }
          const val = Number(p.valorFinal || p.valor) || 0
          
          if (last6Months.includes(k)) {
             recMap[k] = (recMap[k] ?? 0) + val
          }
          if (k === mes) receitaMes += val
          if (k === mesPrev) receitaPrev += val
        }
      }
    }

    const inadimplenciaRate = totalAlunos > 0 ? (inadimplentes / totalAlunos) * 100 : 0

    const varReceita = receitaPrev > 0 ? ((receitaMes - receitaPrev) / receitaPrev) * 100 : 0

    const turmasArr = resTurmas.data ?? []
    const capTotal = turmasArr.reduce((s: number, t: any) => s + (Number(t.capacidade) || 0), 0)
    const taxaOcupacao = capTotal > 0 ? (totalAlunos / capTotal) * 100 : 0

    // Gráfico receita x despesa — últimos 6 meses
    const desMap: Record<string, number> = {}
    for (const c of (resChartDespesa.data ?? [])) {
      const k = (c.vencimento as string)?.slice(0, 7)
      if (k) desMap[k] = (desMap[k] ?? 0) + (Number(c.valor) || 0)
    }
    const chartData = last6Months.map(k => ({
      mes: getMonthLabel(k),
      receita: recMap[k] ?? 0,
      despesa: desMap[k] ?? 0,
    }))

    // Despesas por categoria no mês atual
    const catMap: Record<string, number> = {}
    for (const c of (resDespesasCat.data ?? [])) {
      const cat = (c.categoria as string) || 'Sem Categoria'
      catMap[cat] = (catMap[cat] ?? 0) + (Number(c.valor) || 0)
    }
    const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']
    const despesasPorCategoria = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, valor], i) => ({ nome, valor, fill: CORES[i % CORES.length] }))

    return NextResponse.json({
      totalAlunos,
      receitaMes,
      receitaPrev,
      varReceita,
      inadimplentes,
      inadimplenciaRate,
      taxaOcupacao,
      novasMatriculas: resNovasMatriculas.count ?? 0,
      nFuncionarios: resFuncionarios.count ?? 0,
      nTurmas: turmasArr.length,
      riscoAlto,
      riscoMedio,
      riscoBaixo,
      totalRisco: riscoAlto + riscoMedio,
      RISCO_EVASAO_DIST: [
        { nome: 'Baixo', valor: riscoBaixo, fill: '#10b981' },
        { nome: 'Médio', valor: riscoMedio, fill: '#f59e0b' },
        { nome: 'Alto',  valor: riscoAlto, fill: '#ef4444' }
      ],
      chartData,
      despesasPorCategoria,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
