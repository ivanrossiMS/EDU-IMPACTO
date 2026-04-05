/**
 * app/api/boletos/remessa400/route.ts
 * POST /api/boletos/remessa400
 * Gera arquivo de remessa CNAB 400 completo — SERVER-SIDE ONLY
 */
import { NextRequest, NextResponse } from 'next/server'
import { gerarArquivoRemessa400 } from '@/lib/banking/cnab400'
import { validarEmissao } from '@/lib/banking/validacao'
import type { TituloCobranca, ConvenioBancario } from '@/lib/banking/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      titulos: TituloCobranca[]
      convenio: ConvenioBancario
      sequencialArquivo?: number
    }

    const { titulos, convenio, sequencialArquivo = 1 } = body

    // ── Validações de entrada ────────────────────────────────────────────────
    if (!titulos || titulos.length === 0) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Nenhum título informado para a remessa CNAB 400',
      }, { status: 400 })
    }

    if (!convenio) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Convênio bancário é obrigatório',
      }, { status: 400 })
    }

    // ── Verifica se todos os títulos têm dados bancários completos ───────────
    const errosPorTitulo: string[] = []

    for (const titulo of titulos) {
      const erros: string[] = []

      if (!titulo.nossoNumero) {
        erros.push(`Título "${titulo.numeroDocumento || titulo.id}": Nosso Número não gerado — clique em \"Emitir Boleto\" antes de incluir na remessa`)
      }

      // pagadorNome é aviso, não bloqueante — CNAB usa responsavel/aluno como fallback
      // pagadorCpfCnpj é aviso, não bloqueante — CNAB preenche com zeros se ausente
      // Esses avisos já são tratados pelo gerarDetalheRemessa400

      if (erros.length > 0) {
        errosPorTitulo.push(...erros)
      }
    }

    if (errosPorTitulo.length > 0) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Dados incompletos em alguns títulos',
        erros: errosPorTitulo,
      }, { status: 422 })
    }

    // ── Gera o arquivo CNAB 400 ──────────────────────────────────────────────
    const resultado = gerarArquivoRemessa400(titulos, convenio, sequencialArquivo)

    // ── Diagnóstico byte-a-byte para debug do erro posição 077 ──────────────
    const linhas = resultado.conteudo.split('\r\n').filter(l => l.length >= 400)
    const diagnostico = linhas.map((linha, idx) => {
      const tipo = linha[0] === '0' ? 'HEADER' : linha[0] === '1' ? 'DETALHE' : 'TRAILER'
      return {
        linha: idx + 1,
        tipo,
        totalChars: linha.length,
        // Posições críticas (1-indexed → 0-indexed para slice)
        pos029_dac: linha.slice(28, 29),
        pos063_070_nossoNum: linha.slice(62, 70),
        pos071_dvNN: linha.slice(70, 71),
        pos072_076: linha.slice(71, 76),
        pos077_079_banco: linha.slice(76, 79),
        pos080_082: linha.slice(79, 82),
        pos108_carteira: linha.slice(107, 108),
        pos392_394: linha.slice(391, 394),
        // Dump completo da região 070-085 em hex e ASCII para investigação
        regiao_070_085_ascii: linha.slice(69, 85),
        regiao_070_085_hex: Array.from(linha.slice(69, 85)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '),
      }
    })
    console.log('[CNAB400 DIAGNOSTICO]', JSON.stringify(diagnostico, null, 2))

    // ── Grava evento de auditoria ────────────────────────────────────────────
    const evento = {
      id: `EVT-REM400-${Date.now()}`,
      data: new Date().toISOString(),
      tipo: 'remessa' as const,
      descricao: `Remessa CNAB 400 gerada — ${resultado.qtdTitulos} título(s) — Total: R$ ${resultado.valorTotal.toFixed(2)}`,
      payload: JSON.stringify({
        filename: resultado.filename,
        qtdTitulos: resultado.qtdTitulos,
        valorTotal: resultado.valorTotal,
        sequencialArquivo,
        geradoEm: new Date().toISOString(),
      }),
    }

    return NextResponse.json({
      sucesso: true,
      filename: resultado.filename,
      conteudo: resultado.conteudo,
      diagnostico,
      stats: {
        qtdTitulos: resultado.qtdTitulos,
        valorTotal: resultado.valorTotal,
        qtdLinhas: resultado.qtdLinhas,
        sequencialArquivo: resultado.sequencialArquivo,
      },
      evento,
      geradoEm: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[API /boletos/remessa400]', err)
    return NextResponse.json({
      sucesso: false,
      erro: `Erro ao gerar remessa CNAB 400: ${(err as Error).message}`,
    }, { status: 500 })
  }
}
