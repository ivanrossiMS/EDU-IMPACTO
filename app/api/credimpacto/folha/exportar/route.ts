import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetParcelasFolha } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const competencia = searchParams.get('competencia') || undefined
    const formato = searchParams.get('formato') || 'xlsx' // 'xlsx' ou 'csv'

    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Acesso restrito ao financeiro.' }, { status: 403 })
    }

    const parcelas = await dbGetParcelasFolha(competencia)

    const rows = parcelas.map((p) => ({
      Matrícula: p.colaboradorMatricula || 'N/A',
      Colaborador: p.colaboradorNome,
      CPF: p.colaboradorCpf,
      Operação: p.codigoOperacao,
      Parcela: `${p.numero}`,
      Competência: p.competencia,
      Vencimento: p.dataVencimento,
      'Amortização (R$)': Number(p.valorAmortizacao.toFixed(2)),
      'Juros (R$)': Number(p.valorJuros.toFixed(2)),
      'Valor Total Desconto (R$)': Number(p.valorTotal.toFixed(2)),
      Situação: p.status.toUpperCase(),
      'Data Pagamento': p.dataPagamento || '-',
      'Valor Efetivo Pago (R$)': p.valorPago ? Number(p.valorPago.toFixed(2)) : '-'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Ajusta larguras de coluna
    ws['!cols'] = [
      { wch: 12 }, // Matrícula
      { wch: 30 }, // Colaborador
      { wch: 15 }, // CPF
      { wch: 16 }, // Operação
      { wch: 8 },  // Parcela
      { wch: 12 }, // Competência
      { wch: 12 }, // Vencimento
      { wch: 16 }, // Amortização
      { wch: 12 }, // Juros
      { wch: 22 }, // Valor Total
      { wch: 14 }, // Situação
      { wch: 14 }, // Data Pgto
      { wch: 20 }  // Valor Pago
    ]

    const sheetName = competencia ? `Folha_${competencia.replace('/', '-')}` : 'Parcelas_Folha'
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    if (formato === 'csv') {
      const csvData = XLSX.utils.sheet_to_csv(ws)
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="CredImpacto_${sheetName}.csv"`
        }
      })
    }

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="CredImpacto_${sheetName}.xlsx"`
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao exportar folha' }, { status: 500 })
  }
}
