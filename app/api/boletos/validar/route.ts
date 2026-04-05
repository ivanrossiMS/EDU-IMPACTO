/**
 * app/api/boletos/validar/route.ts
 * POST /api/boletos/validar
 * Valida os dados de emissão sem emitir o boleto
 */
import { NextRequest, NextResponse } from 'next/server'
import { validarEmissao } from '@/lib/banking/validacao'
import type { TituloEmissaoInput, ConvenioBancario } from '@/lib/banking/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      titulo: TituloEmissaoInput
      convenio: ConvenioBancario
    }

    if (!body.titulo || !body.convenio) {
      return NextResponse.json({
        valido: false,
        erros: ['Dados incompletos: titulo e convenio são obrigatórios'],
        avisos: [],
      }, { status: 400 })
    }

    const resultado = validarEmissao(body.titulo, body.convenio)

    return NextResponse.json(resultado, { status: resultado.valido ? 200 : 422 })

  } catch (err) {
    console.error('[API /boletos/validar]', err)
    return NextResponse.json({
      valido: false,
      erros: ['Erro interno na validação: ' + (err as Error).message],
      avisos: [],
    }, { status: 500 })
  }
}
