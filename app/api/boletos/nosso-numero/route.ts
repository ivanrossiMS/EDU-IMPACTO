/**
 * app/api/boletos/nosso-numero/route.ts
 * GET /api/boletos/nosso-numero?ultimo=N&carteira=109
 * Gera o próximo Nosso Número com DV para o Itaú
 */
import { NextRequest, NextResponse } from 'next/server'
import { gerarNossoNumeroItau } from '@/lib/banking/nossoNumero'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ultimo = parseInt(searchParams.get('ultimo') || '0')
    const carteira = searchParams.get('carteira') || '109'

    if (isNaN(ultimo) || ultimo < 0) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Parâmetro "ultimo" deve ser um número inteiro não negativo',
      }, { status: 400 })
    }

    const CARTEIRAS_VALIDAS = ['109', '112', '175', '196', '198']
    if (!CARTEIRAS_VALIDAS.includes(carteira)) {
      return NextResponse.json({
        sucesso: false,
        erro: `Carteira "${carteira}" inválida para o Itaú. Válidas: ${CARTEIRAS_VALIDAS.join(', ')}`,
      }, { status: 400 })
    }

    const resultado = gerarNossoNumeroItau(ultimo, carteira)

    return NextResponse.json({
      sucesso: true,
      nossoNumero: resultado.nossoNumero,
      dvNossoNumero: resultado.dvNossoNumero,
      nossoNumeroDV: resultado.nossoNumeroDV,
      nossoNumeroFormatado: resultado.nossoNumeroFormatado,
      sequencial: resultado.sequencial,
      carteira,
    })

  } catch (err) {
    console.error('[API /boletos/nosso-numero]', err)
    return NextResponse.json({
      sucesso: false,
      erro: `Erro ao gerar nosso número: ${(err as Error).message}`,
    }, { status: 500 })
  }
}
