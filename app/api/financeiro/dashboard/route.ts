import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') // formato YYYY-MM
    const mesPrev = searchParams.get('mesPrev')
    
    if (!mes || !mesPrev) {
      return NextResponse.json({ error: 'mes and mesPrev are required' }, { status: 400 })
    }

    const supabase = await createProtectedClient()

    // 1. Receita (Apenas titulos pagos nestes 2 meses)
    // Reduz dramaticamente a carga sobre o banco puxando SÓ os pagos no período!
    const { data: dMes } = await supabase.from('titulos')
      .select('valor')
      .eq('status', 'pago')
      .ilike('pagamento', `${mes}%`)
      
    const { data: dPrev } = await supabase.from('titulos')
      .select('valor')
      .eq('status', 'pago')
      .ilike('pagamento', `${mesPrev}%`)

    const receitaMes = (dMes || []).reduce((s: number, t: any) => s + (Number(t.valor) || 0), 0)
    const receitaPrev = (dPrev || []).reduce((s: number, t: any) => s + (Number(t.valor) || 0), 0)
    const varReceita = receitaPrev > 0 ? ((receitaMes - receitaPrev) / receitaPrev) * 100 : 0

    // 2. Alunos & Inadimplência
    const { count: totalAlunos } = await supabase.from('alunos')
      .select('id', { count: 'exact', head: true })
      
    const { count: inadimplentes } = await supabase.from('alunos')
      .select('id', { count: 'exact', head: true })
      .filter('dados->>inadimplente', 'eq', 'true')
      
    const inadimplenciaRate = (totalAlunos && totalAlunos > 0) ? ((inadimplentes||0) / totalAlunos) * 100 : 0

    // 3. Riscos de Evasão (Contagens rápidas Head-Only via DB)
    const { count: riscoAlto } = await supabase.from('alunos')
      .select('id', { count: 'exact', head: true })
      .filter('dados->>risco_evasao', 'eq', 'alto')
      
    const { count: riscoMedio } = await supabase.from('alunos')
      .select('id', { count: 'exact', head: true })
      .filter('dados->>risco_evasao', 'eq', 'medio')
      
    const { count: riscoBaixo } = await supabase.from('alunos')
      .select('id', { count: 'exact', head: true })
      .filter('dados->>risco_evasao', 'eq', 'baixo')

    // 4. Novas Matrículas do Lead (Contagem Head-Only)
    const { count: novasMatriculas } = await supabase.from('crm/leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'matriculado')

    // 5. Funcionarios (Contagem)
    const { count: nFuncionarios } = await supabase.from('rh/funcionarios')
      .select('id', { count: 'exact', head: true })

    // 6. Turmas Cadastradas
    const { data: turmas, count: totalTurmas } = await supabase.from('turmas')
      .select('dados', { count: 'exact' })

    const taxaOcupacao = (turmas && totalTurmas && totalTurmas > 0)
      ? turmas.reduce((s, t) => s + (t.dados?.capacidade > 0 ? (t.dados.matriculados / t.dados.capacidade) * 100 : 0), 0) / totalTurmas
      : 0

    return NextResponse.json({
      totalAlunos: totalAlunos || 0,
      receitaMes,
      receitaPrev,
      varReceita,
      inadimplentes: inadimplentes || 0,
      inadimplenciaRate,
      taxaOcupacao,
      novasMatriculas: novasMatriculas || 0,
      nFuncionarios: nFuncionarios || 0,
      totalTurmas: totalTurmas || 0,
      riscoAlto: riscoAlto || 0,
      riscoMedio: riscoMedio || 0,
      riscoBaixo: riscoBaixo || 0,
      totalRisco: (riscoAlto || 0) + (riscoMedio || 0),
      RISCO_EVASAO_DIST: [
        { nome: 'Baixo', valor: riscoBaixo || 0, fill: '#10b981' },
        { nome: 'Médio', valor: riscoMedio || 0, fill: '#f59e0b' },
        { nome: 'Alto',  valor: riscoAlto || 0, fill: '#ef4444' }
      ]
    }, { 
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } 
    })
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
