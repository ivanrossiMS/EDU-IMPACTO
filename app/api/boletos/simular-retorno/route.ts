/**
 * app/api/boletos/simular-retorno/route.ts
 * POST /api/boletos/simular-retorno
 * Gera retorno simulado CNAB 400 para sandbox/homologação
 * Útil antes de ter acesso real ao banco
 */
import { NextRequest, NextResponse } from 'next/server'
import { gerarRetornoSimulado400 } from '@/lib/banking/cnab400'
import type { TituloCobranca, ConvenioBancario } from '@/lib/banking/types'

const OCORRENCIAS_VALIDAS = ['02', '03', '06', '09', '14', '25']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      titulos: TituloCobranca[]
      convenio: ConvenioBancario
      ocorrencia?: string // '06' = liquidado (padrão), '03' = rejeitado, '09' = baixado
    }

    const { titulos, convenio, ocorrencia = '06' } = body

    if (!titulos || titulos.length === 0) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Nenhum título informado para simulação',
      }, { status: 400 })
    }

    if (!OCORRENCIAS_VALIDAS.includes(ocorrencia)) {
      return NextResponse.json({
        sucesso: false,
        erro: `Ocorrência "${ocorrencia}" inválida para simulação. Válidas: ${OCORRENCIAS_VALIDAS.join(', ')}`,
      }, { status: 400 })
    }

    const resultado = gerarRetornoSimulado400(titulos, convenio, ocorrencia)

    return NextResponse.json({
      sucesso: true,
      filename: resultado.filename,
      conteudo: resultado.conteudo,
      ocorrenciaSimulada: ocorrencia,
      qtdTitulos: titulos.length,
      aviso: '⚠️ Este é um retorno SIMULADO para fins de homologação. NÃO representa dados reais do banco.',
      geradoEm: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[API /boletos/simular-retorno]', err)
    return NextResponse.json({
      sucesso: false,
      erro: `Erro ao simular retorno: ${(err as Error).message}`,
    }, { status: 500 })
  }
}
