/**
 * app/api/boletos/remessa/route.ts
 * POST /api/boletos/remessa
 * Gera arquivo CNAB 240 de remessa
 */
import { NextRequest, NextResponse } from 'next/server'
import { gerarArquivoRemessa240 } from '@/lib/banking/cnab240'
import type { TituloCobranca, ConvenioBancario } from '@/lib/banking/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      titulos: TituloCobranca[]
      convenio: ConvenioBancario
      sequencial: number // número sequencial da remessa (controle do beneficiário)
    }

    const { titulos, convenio, sequencial = 1 } = body

    if (!titulos || titulos.length === 0) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Nenhum título informado para a remessa',
      }, { status: 400 })
    }

    if (!convenio) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Convênio bancário é obrigatório',
      }, { status: 400 })
    }

    // Verificar se todos têm nosso número e código de barras
    const semDadosBancarios = titulos.filter(t => !t.nossoNumero || !t.codigoBarras44)
    if (semDadosBancarios.length > 0) {
      return NextResponse.json({
        sucesso: false,
        erro: `${semDadosBancarios.length} título(s) sem dados bancários completos (emitir antes de gerar remessa)`,
        titulosProblema: semDadosBancarios.map(t => t.id || t.numeroDocumento),
      }, { status: 422 })
    }

    const resultado = gerarArquivoRemessa240(titulos, convenio, sequencial)

    // Converter para base64 para download
    const base64 = Buffer.from(resultado.conteudo, 'latin1').toString('base64')

    return NextResponse.json({
      sucesso: true,
      filename: resultado.filename,
      conteudo: resultado.conteudo,  // texto puro CNAB
      base64,
      stats: resultado.stats,
      geradoEm: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[API /boletos/remessa]', err)
    return NextResponse.json({
      sucesso: false,
      erro: `Erro ao gerar remessa: ${(err as Error).message}`,
    }, { status: 500 })
  }
}
