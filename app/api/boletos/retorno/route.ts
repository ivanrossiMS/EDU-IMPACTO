/**
 * app/api/boletos/retorno/route.ts
 * POST /api/boletos/retorno
 * Processa arquivo de retorno CNAB 240 do banco
 */
import { NextRequest, NextResponse } from 'next/server'
import { processarRetornoCNAB240, interpretarOcorrencia240 } from '@/lib/banking/cnab240'

// Mapeamento de ocorrências para status do título
const OCORRENCIA_STATUS: Record<string, string> = {
  '02': 'registrado',
  '03': 'rejeitado',
  '06': 'liquidado',
  '07': 'liquidado',
  '08': 'liquidado',
  '09': 'baixado',
  '10': 'baixado',
  '14': 'vencido',
  '25': 'baixado',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      conteudo: string // texto do arquivo CNAB 240
      convenioId?: string
    }

    if (!body.conteudo) {
      return NextResponse.json({
        sucesso: false,
        erro: 'Conteúdo do arquivo de retorno é obrigatório',
      }, { status: 400 })
    }

    const registros = processarRetornoCNAB240(body.conteudo)

    if (registros.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Nenhum registro de detalhe encontrado no arquivo',
        registros: [],
        atualizacoes: [],
      })
    }

    // Gera lista de atualizações a serem aplicadas no front-end
    const atualizacoes = registros.map(r => ({
      nossoNumero: r.nossoNumero,
      numeroDocumento: r.numeroDocumento,
      ocorrencia: r.ocorrencia,
      descricaoOcorrencia: r.descricaoOcorrencia,
      novoStatus: OCORRENCIA_STATUS[r.ocorrencia] || null,
      valorPago: r.valorPago,
      dataPagamento: r.dataPagamento,
      dataOcorrencia: r.dataOcorrencia,
      // Evento de auditoria para salvar
      evento: {
        id: `EVT-RET-${Date.now()}-${r.nossoNumero}`,
        data: new Date().toISOString(),
        tipo: ['06','07','08','10'].includes(r.ocorrencia) ? 'baixa' :
              r.ocorrencia === '03' ? 'rejeicao' :
              r.ocorrencia === '02' ? 'emissao' : 'retorno',
        descricao: `Retorno banco: ${r.descricaoOcorrencia} (ocorrência ${r.ocorrencia})${r.valorPago ? ` — Pago: R$ ${r.valorPago.toFixed(2)}` : ''}`,
        payload: JSON.stringify(r),
      },
    }))

    return NextResponse.json({
      sucesso: true,
      totalRegistros: registros.length,
      registros,
      atualizacoes,
      processadoEm: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[API /boletos/retorno]', err)
    return NextResponse.json({
      sucesso: false,
      erro: `Erro ao processar retorno: ${(err as Error).message}`,
    }, { status: 500 })
  }
}
