import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { gerarContratoPdf } from '@/lib/contracts/contractPdfGenerator'
import { ContractDataModel } from '@/lib/contracts/contractTemplates'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { aluno, responsavel, tipoDocumento = 'requerimento_matricula' } = body

    if (!aluno?.nome) {
      return NextResponse.json({ error: 'Estudante não informado.' }, { status: 400 })
    }

    const contractData: ContractDataModel = {
      escolaNome: 'COLÉGIO IMPACTO',
      escolaRazaoSocial: 'Colégio Impacto de Ensino Ltda',
      escolaCnpj: '00.000.000/0001-00',
      escolaEndereco: 'Rua Principal da Educação, 100',
      escolaCidadeUf: 'Campo Grande - MS',
      escolaTelefone: '(67) 3000-0000',
      escolaEmail: 'secretaria@colegioimpacto.com.br',

      alunoId: aluno.id || '',
      alunoNome: aluno.nome,
      alunoCpf: aluno.cpf || '',
      alunoRg: aluno.rg || '',
      alunoDataNasc: aluno.dataNascimento || aluno.data_nascimento || '',
      alunoMatricula: aluno.matricula || aluno.codigo || '',
      alunoTurma: aluno.turma || '',
      alunoSerie: aluno.serie || '',
      alunoTurno: aluno.turno || 'Matutino',

      respNome: responsavel?.nome || 'Responsável',
      respCpf: responsavel?.cpf || '',
      respParentesco: responsavel?.parentesco || 'Responsável Legal',
      respTelefone: responsavel?.telefone || '',
      respEmail: responsavel?.email || '',

      anoLetivo: '2027',
      valorAnuidade: 0,
      valorMensalidade: 0,
      numParcelas: 12,
      descontoPercent: 0,
      diaVencimento: 10,
      tipoDocumento: tipoDocumento === 'contrato_servicos' ? 'contrato_servicos' : 'requerimento_matricula',
    }

    const generated = await gerarContratoPdf(contractData)

    return NextResponse.json({
      success: true,
      nomeArquivo: `${generated.docName.replace(/\s+/g, '_')}.pdf`,
      docTitle: generated.docName,
      base64Pdf: `data:application/pdf;base64,${generated.base64Pdf}`,
      tamanho: `${Math.round((generated.pdfBytes.length) / 1024)} KB`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar PDF.' }, { status: 500 })
  }
}
