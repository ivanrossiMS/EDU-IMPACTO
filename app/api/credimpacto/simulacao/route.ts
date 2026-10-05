import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetConfiguracao } from '@/lib/credimpacto/db'
import { simulateLoan } from '@/lib/credimpacto/engine'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import { MetodoCalculo } from '@/types/credimpacto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { valorSolicitado, quantidadeParcelas, metodoCalculo, taxaMensal, salarioBase } = body

    if (!valorSolicitado || valorSolicitado <= 0) {
      return NextResponse.json({ error: 'Informe um valor válido para simulação.' }, { status: 400 })
    }

    if (!quantidadeParcelas || quantidadeParcelas < 1) {
      return NextResponse.json({ error: 'Informe a quantidade de parcelas desejada.' }, { status: 400 })
    }

    const config = await dbGetConfiguracao()
    const resolvedUser = await resolveCredImpactoUser(user)

    // Se o usuário não for admin, força a taxa e métodos permitidos pela política da escola
    let taxa = Number(taxaMensal)
    if (isNaN(taxa) || (!resolvedUser.isAdminOrFinance && taxa !== config.taxaMensalPadrao)) {
      taxa = config.taxaMensalPadrao
    }

    let metodo: MetodoCalculo = metodoCalculo || config.metodoCalculoPadrao
    if (!resolvedUser.isAdminOrFinance && !config.metodosPermitidos.includes(metodo)) {
      metodo = config.metodoCalculoPadrao
    }

    const salarioParaCalculo = salarioBase ? Number(salarioBase) : resolvedUser.salarioBase

    const simulacao = simulateLoan(
      Number(valorSolicitado),
      Number(quantidadeParcelas),
      taxa,
      metodo,
      salarioParaCalculo,
      new Date(),
      config.diaPadraoDescontoFolha
    )

    return NextResponse.json(simulacao)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao calcular simulação' }, { status: 400 })
  }
}
