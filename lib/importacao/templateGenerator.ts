import * as XLSX from 'xlsx'

export function downloadAllInOneTemplate() {
  const wb = XLSX.utils.book_new()

  const headers = [
    // ALUNO
    'MATRICULA',
    'NOME COMPLETO ALUNO',
    'DATA NASCIMENTO',
    'SEXO (M/F)',
    'CPF ALUNO',
    'RG ALUNO',
    'TELEFONE ALUNO',
    'EMAIL ALUNO',
    'TURMA',
    'SERIE',
    'SEGMENTO',
    'TURNO',
    'ANO LETIVO',
    'ALUNO ATIVO (Sim/Não)',
    'PODE SAIR SOZINHO (Sim/Não)',
    'INTEGRAL/INTERMEDIÁRIO (Sim/Não)',
    'CEP',
    'LOGRADOURO',
    'NUMERO',
    'BAIRRO',
    'CIDADE',
    'ESTADO (UF)',
    // MÃE / RESPONSÁVEL 1
    'NOME MAE / RESP 1',
    'PARENTESCO 1',
    'CPF RESP 1',
    'TELEFONE RESP 1',
    'EMAIL RESP 1',
    'PROFISSAO 1',
    'RFID RESP 1',
    'RESP 1 FINANCEIRO (Sim/Não)',
    'RESP 1 PEDAGOGICO (Sim/Não)',
    'RESP 1 AUTORIZADO RETIRAR (Sim/Não)',
    // PAI / RESPONSÁVEL 2
    'NOME PAI / RESP 2',
    'PARENTESCO 2',
    'CPF RESP 2',
    'TELEFONE RESP 2',
    'EMAIL RESP 2',
    'PROFISSAO 2',
    'RFID RESP 2',
    'RESP 2 FINANCEIRO (Sim/Não)',
    'RESP 2 PEDAGOGICO (Sim/Não)',
    'RESP 2 AUTORIZADO RETIRAR (Sim/Não)'
  ]

  const sampleRows = [
    [
      '10001',
      'Arthur Martins Souza',
      '15/05/2015',
      'M',
      '123.456.789-00',
      '12.345.678-9',
      '11999999999',
      'arthur.souza@impacto.com.br',
      '5º Ano A',
      '5º Ano',
      'Ensino Fundamental I',
      'Matutino',
      '2026',
      'Sim',
      'Não',
      'Sim',
      '01310-100',
      'Av. Paulista',
      '1000',
      'Bela Vista',
      'São Paulo',
      'SP',
      'Juliana Martins Souza',
      'Mãe',
      '234.567.890-11',
      '11988887777',
      'juliana.martins@gmail.com',
      'Advogada',
      '0008153953',
      'Sim',
      'Sim',
      'Sim',
      'Claudio Souza',
      'Pai',
      '345.678.901-22',
      '11977776666',
      'claudio.souza@gmail.com',
      'Engenheiro',
      '0008153954',
      'Não',
      'Sim',
      'Sim'
    ],
    [
      '10002',
      'Bianca Soares Duarte',
      '20/08/2016',
      'F',
      '987.654.321-99',
      '98.765.432-1',
      '11988888888',
      'bianca.duarte@impacto.com.br',
      '4º Ano B',
      '4º Ano',
      'Ensino Fundamental I',
      'Vespertino',
      '2026',
      'Sim',
      'Sim',
      'Não',
      '04571-010',
      'Rua Funchal',
      '200',
      'Vila Olímpia',
      'São Paulo',
      'SP',
      'Lucia Duarte',
      'Mãe',
      '456.789.012-33',
      '11966665555',
      'lucia.duarte@gmail.com',
      'Médica',
      '0008233620',
      'Sim',
      'Sim',
      'Sim',
      'Roberto Duarte',
      'Pai',
      '567.890.123-44',
      '11955554444',
      'roberto.duarte@gmail.com',
      'Arquiteto',
      '0008233621',
      'Sim',
      'Não',
      'Sim'
    ]
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])

  // Ajuste de largura das colunas
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 3, 16) }))

  XLSX.utils.book_append_sheet(wb, ws, 'Planilha Geral de Alunos')

  // Aba de Instruções e Dicas Úteis para a Secretaria
  const instrucoes = [
    ['GUIA DE PREENCHIMENTO RÁPIDO - IMPACTO EDU ERP'],
    [''],
    ['1. COLUNA NOME COMPLETO ALUNO: É a única coluna estritamente obrigatória.'],
    ['2. DATA DE NASCIMENTO: Pode ser no formato DD/MM/AAAA (ex: 15/05/2015) ou AAAA-MM-DD.'],
    ['3. CPF E TELEFONES: Podem ter pontos e traços ou apenas números. O sistema formata sozinho!'],
    ['4. TURMAS: Se a turma ainda não existir no sistema, você poderá criá-la com 1 clique durante a importação.'],
    ['5. IRMÃOS: Se dois alunos tiverem os mesmos pais (mesmo CPF ou telefone), o sistema vincula ambos automaticamente sem duplicar o pai/mãe.'],
    ['6. VOCÊ NÃO PRECISA PREENCHER TODAS AS COLUNAS: Preencha apenas o que a sua escola tiver no momento.']
  ]
  const wsInstrucoes = XLSX.utils.aoa_to_sheet(instrucoes)
  wsInstrucoes['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Como Preencher')

  XLSX.writeFile(wb, 'modelo_importacao_completo_impacto_edu.xlsx')
}
