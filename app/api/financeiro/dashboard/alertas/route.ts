import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createProtectedClient()
    const hoje = new Date()

    // Todas as queries críticas em paralelo
    const [
      resFrequencia,
      resTitulosAtrasados,
      resRiscoAlto,
      resContasPagar,
      resOcorrencias,
    ] = await Promise.all([
      supabase.from('alunos').select('id, nome, frequencia').lt('frequencia', 60).eq('status', 'matriculado').limit(20),
      supabase.from('titulos').select('id, valor').eq('status', 'atrasado'),
      supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('risco_evasao', 'alto'),
      supabase.from('contas_pagar').select('id, valor, vencimento').neq('status', 'pago')
        .gte('vencimento', hoje.toISOString().split('T')[0])
        .lte('vencimento', new Date(hoje.getTime() + 7 * 86400000).toISOString().split('T')[0]),
      supabase.from('ocorrencias').select('id', { count: 'exact', head: true })
        .eq('gravidade', 'grave')
        .eq('ciencia_responsavel', false),
    ])

    const alertas: {
      id: string
      nivel: 'critico' | 'alto' | 'medio' | 'info'
      titulo: string
      descricao: string
      acao: string
      link: string
    }[] = []

    // Frequência crítica
    const criticos = resFrequencia.data ?? []
    if (criticos.length > 0) {
      alertas.push({
        id: 'auto-freq',
        nivel: 'critico',
        titulo: `${criticos.length} aluno${criticos.length > 1 ? 's' : ''} com frequência crítica`,
        descricao: `Abaixo de 60% — ${criticos.slice(0, 4).map((a: any) => a.nome?.split(' ')[0]).join(', ')}${criticos.length > 4 ? '...' : ''}`,
        acao: 'Ver alunos',
        link: '/academico/frequencia',
      })
    }

    // Inadimplência
    const titulosAtrasados = resTitulosAtrasados.data ?? []
    if (titulosAtrasados.length > 0) {
      const valorTotal = titulosAtrasados.reduce((s: number, t: any) => s + (Number(t.valor) || 0), 0)
      alertas.push({
        id: 'auto-inad',
        nivel: 'alto',
        titulo: `${formatCurrency(valorTotal)} em títulos atrasados`,
        descricao: `${titulosAtrasados.length} título(s) em atraso sem registro de pagamento`,
        acao: 'Ver inadimplência',
        link: '/financeiro/inadimplencia',
      })
    }

    // Risco alto de evasão
    const riscoAltoCount = resRiscoAlto.count ?? 0
    if (riscoAltoCount > 0) {
      alertas.push({
        id: 'auto-risco',
        nivel: 'medio',
        titulo: `${riscoAltoCount} aluno${riscoAltoCount > 1 ? 's' : ''} em risco alto de evasão`,
        descricao: 'Classificados por frequência, notas e histórico financeiro',
        acao: 'Ver alunos',
        link: '/academico/alunos',
      })
    }

    // Contas a pagar nos próximos 7 dias
    const proxVenc = resContasPagar.data ?? []
    if (proxVenc.length > 0) {
      const val = proxVenc.reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0)
      alertas.push({
        id: 'auto-cp',
        nivel: 'info',
        titulo: `${proxVenc.length} conta${proxVenc.length > 1 ? 's' : ''} a pagar nos próximos 7 dias`,
        descricao: `Total: ${formatCurrency(val)}`,
        acao: 'Ver contas',
        link: '/financeiro/pagar',
      })
    }

    // Ocorrências graves
    const ocGravesCount = resOcorrencias.count ?? 0
    if (ocGravesCount > 0) {
      alertas.push({
        id: 'auto-oc',
        nivel: 'alto',
        titulo: `${ocGravesCount} ocorrência${ocGravesCount > 1 ? 's' : ''} grave${ocGravesCount > 1 ? 's' : ''} sem ciência`,
        descricao: 'Responsáveis ainda não foram notificados',
        acao: 'Ver ocorrências',
        link: '/academico/ocorrencias',
      })
    }

    return NextResponse.json({ alertas }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    })

  } catch (err: any) {
    return NextResponse.json({ alertas: [], error: err.message }, { status: 200 })
  }
}
