/**
 * app/api/boletos/retorno400/route.ts
 * POST /api/boletos/retorno400
 * Processa arquivo de retorno CNAB 400 do banco — SERVER-SIDE ONLY
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  processarRetornoCNAB400,
  interpretarOcorrencia400,
  OCORRENCIA_STATUS_400,
} from '@/lib/banking/cnab400'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      conteudo: string // Texto do arquivo CNAB 400
      convenioId?: string
    }

    if (!body.conteudo) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Conteúdo do arquivo de retorno é obrigatório',
      }, { status: 400 })
    }

    // ── Validação básica do arquivo ──────────────────────────────────────────
    const linhas = body.conteudo.split(/\r?\n/).filter(l => l.trim().length > 0)

    if (linhas.length < 2) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Arquivo de retorno muito pequeno ou vazio',
      }, { status: 400 })
    }

    // Verifica se é CNAB 400 (linhas de 400 chars)
    const linhasComTamanhoErrado = linhas.filter(l => l.length > 0 && l.length !== 400)
    if (linhasComTamanhoErrado.length > 0) {
      return NextResponse.json({
        sucesso: false,
        erro: `Arquivo inválido: ${linhasComTamanhoErrado.length} linha(s) não têm 400 caracteres`,
        linhasComErro: linhasComTamanhoErrado.slice(0, 3).map((l, i) => ({
          numero: i + 1,
          comprimento: l.length,
          inicio: l.slice(0, 20),
        })),
      }, { status: 400 })
    }

    // Verifica se é retorno (posição 2 = '2')
    const headerLine = linhas.find(l => l[0] === '0')
    if (headerLine && headerLine[1] !== '2') {
      return NextResponse.json({
        sucesso: false,
        erro: 'Arquivo não parece ser um retorno (posição 2 do header deveria ser "2"). Possível arquivo de remessa enviado por engano.',
      }, { status: 400 })
    }

    // ── Processa o retorno ───────────────────────────────────────────────────
    const resultado = processarRetornoCNAB400(body.conteudo)

    // ── Gera lista de atualizações para o front-end aplicar ─────────────────
    const atualizacoes = resultado.registros.map((r, idx) => {
      const novoStatus = OCORRENCIA_STATUS_400[r.ocorrencia || ''] || null

      return {
        // Chave de matching com o título
        nossoNumero: r.nossoNumero,
        idEmpresa: r.idEmpresa,
        // Dados da ocorrência
        ocorrencia: r.ocorrencia,
        descricaoOcorrencia: r.descricaoOcorrencia,
        novoStatus,
        // Dados financeiros
        valorPago: r.valorPago,
        valorTitulo: r.valorTitulo,
        valorDesconto: r.valorDesconto,
        valorAbatimento: r.valorAbatimento,
        valorJuros: r.valorJuros,
        // Datas
        dataOcorrencia: r.dataOcorrencia,
        dataCredito: r.dataCredito,
        dataVencimento: r.dataVencimento,
        // Evento para gravar no histórico do título
        evento: {
          id: `EVT-RET400-${Date.now()}-${idx}-${r.nossoNumero}`,
          data: new Date().toISOString(),
          tipo:
            ['06','07','08','10','15','16','17'].includes(r.ocorrencia || '') ? 'baixa' :
            ['03','26','30'].includes(r.ocorrencia || '') ? 'rejeicao' :
            r.ocorrencia === '02' ? 'emissao' : 'retorno',
          descricao: `CNAB 400 Retorno: ${r.descricaoOcorrencia} (occ. ${r.ocorrencia})` +
            (r.valorPago ? ` — Pago: R$ ${r.valorPago.toFixed(2).replace('.', ',')}` : '') +
            (r.dataOcorrencia ? ` em ${r.dataOcorrencia}` : ''),
          payload: JSON.stringify({
            ocorrencia: r.ocorrencia,
            nossoNumero: r.nossoNumero,
            valorPago: r.valorPago,
            dataOcorrencia: r.dataOcorrencia,
            valorJuros: r.valorJuros,
            valorDesconto: r.valorDesconto,
          }),
        },
      }
    })

    return NextResponse.json({
      sucesso: true,
      header: resultado.header,
      resumo: resultado.resumo,
      atualizacoes,
      totalRegistros: resultado.registros.length,
      processadoEm: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[API /boletos/retorno400]', err)
    return NextResponse.json({
      sucesso: false,
      erro: `Erro ao processar retorno CNAB 400: ${(err as Error).message}`,
    }, { status: 500 })
  }
}
