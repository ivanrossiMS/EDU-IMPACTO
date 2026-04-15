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

    // Gera os 6 últimos meses para o gráfico
    const mesDate = new Date(mes + '-01')
    const last6Months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(mesDate.getFullYear(), mesDate.getMonth() - i, 1)
      last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const chartStartMonth = last6Months[0]

    // Todas as queries em paralelo via Promise.all — reduz latência total
    const [
      resMes, resPrev, resAlunos, resInadimplentes,
      resRiscoAlto, resRiscoMedio, resRiscoBaixo,
      resNovasMatriculas, resFuncionarios, resTurmas,
      resChartReceita, resChartDespesa, resDespesasCat
    ] = await Promise.all([
      supabase.from('titulos').select('valor').eq('status', 'pago').ilike('pagamento', `${mes}%`),
      supabase.from('titulos').select('valor').eq('status', 'pago').ilike('pagamento', `${mesPrev}%`),
      supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('status', 'matriculado'),
      supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('inadimplente', true),
      supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('risco_evasao', 'alto'),
      supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('risco_evasao', 'medio'),
      supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('risco_evasao', 'baixo'),
      supabase.from('alunos').select('id', { count: 'exact', head: true })
        .eq('status', 'matriculado')
        .gte('created_at', `${mes}-01`)
        .lt('created_at', `${mes}-32`),
      supabase.from('funcionarios').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
      supabase.from('turmas').select('capacidade, matriculados'),
      supabase.from('titulos').select('valor, pagamento').eq('status', 'pago').gte('pagamento', `${chartStartMonth}-01`),
      supabase.from('contas_pagar').select('valor, vencimento').in('status', ['pago', 'pendente', 'atrasado']).gte('vencimento', `${chartStartMonth}-01`),
      supabase.from('contas_pagar').select('valor, categoria').in('status', ['pago', 'pendente', 'atrasado']).ilike('vencimento', `${mes}%`)
    ])

    const totalAlunos = resAlunos.count ?? 0
    const inadimplentes = resInadimplentes.count ?? 0
    const inadimplenciaRate = totalAlunos > 0 ? (inadimplentes / totalAlunos) * 100 : 0
    const riscoAlto = resRiscoAlto.count ?? 0
    const riscoMedio = resRiscoMedio.count ?? 0
    const riscoBaixo = resRiscoBaixo.count ?? 0

    const receitaMes = (resMes.data ?? []).reduce((s: number, t: any) => s + (Number(t.valor) || 0), 0)
    const receitaPrev = (resPrev.data ?? []).reduce((s: number, t: any) => s + (Number(t.valor) || 0), 0)
    const varReceita = receitaPrev > 0 ? ((receitaMes - receitaPrev) / receitaPrev) * 100 : 0

    const turmasArr = resTurmas.data ?? []
    const capTotal = turmasArr.reduce((s: number, t: any) => s + (Number(t.capacidade) || 0), 0)
    const matTotal = turmasArr.reduce((s: number, t: any) => s + (Number(t.matriculados) || 0), 0)
    const taxaOcupacao = capTotal > 0 ? (matTotal / capTotal) * 100 : 0

    // Gráfico receita x despesa — últimos 6 meses
    const recMap: Record<string, number> = {}
    const desMap: Record<string, number> = {}
    for (const t of (resChartReceita.data ?? [])) {
      const k = (t.pagamento as string)?.slice(0, 7)
      if (k) recMap[k] = (recMap[k] ?? 0) + (Number(t.valor) || 0)
    }
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
