/**
 * lib/contracts/contractTemplates.ts
 *
 * Modelos jurídicos e de secretaria para Matrículas Online.
 * Em conformidade com a LDB (Lei 9.394/96), Lei da Mensalidade Escolar (Lei 9.870/99),
 * Código de Defesa do Consumidor (CDC), LGPD (Lei 13.709/18) e MP 2.200-2/01.
 */

export interface ContractDataModel {
  // Instituição
  escolaNome: string
  escolaRazaoSocial: string
  escolaCnpj: string
  escolaEndereco: string
  escolaCidadeUf: string
  escolaTelefone: string
  escolaEmail: string
  
  // Aluno
  alunoId: string
  alunoNome: string
  alunoCpf?: string
  alunoRg?: string
  alunoDataNasc?: string
  alunoMatricula?: string
  alunoTurma?: string
  alunoSerie?: string
  alunoTurno?: string
  
  // Responsável Financeiro / Signatário
  respNome: string
  respCpf: string
  respRg?: string
  respParentesco?: string
  respEndereco?: string
  respBairro?: string
  respCidadeUf?: string
  respCep?: string
  respTelefone?: string
  respEmail?: string
  
  // Condições Financeiras
  anoLetivo: string
  valorAnuidade: number
  valorMensalidade: number
  numParcelas: number
  descontoPercent: number
  diaVencimento: number
  primeiroVencimento?: string
  
  // Observações e dados extras
  tipoDocumento: 'contrato_servicos' | 'requerimento_matricula' | 'pacote_completo'
}

/**
 * Formata moeda BRL
 */
export function formatCurrencyBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

/**
 * Retorna valor por extenso simplificado
 */
export function valorPorExtenso(val: number): string {
  // Para fins contratuais, exibimos o formato monetário claro
  return `${formatCurrencyBRL(val)}`
}

/**
 * Gera o texto legal do Contrato de Prestação de Serviços Educacionais
 */
export function getTextoContratoServicos(d: ContractDataModel): string {
  const anuidadeStr = formatCurrencyBRL(d.valorAnuidade)
  const mensalidadeStr = formatCurrencyBRL(d.valorMensalidade)
  const descontoStr = d.descontoPercent > 0 ? `${d.descontoPercent}%` : '0%'

  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS – ANO LETIVO ${d.anoLetivo}

I – DAS PARTES CONTRATANTES

CONTRATADA: ${d.escolaRazaoSocial.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${d.escolaCnpj}, com sede à ${d.escolaEndereco}, ${d.escolaCidadeUf}, doravante denominada simplesmente ESCOLA.

CONTRATANTE / RESPONSÁVEL FINANCEIRO: ${d.respNome.toUpperCase()}, inscrito(a) no CPF/MF sob o nº ${d.respCpf}${d.respRg ? `, RG nº ${d.respRg}` : ''}, residente e domiciliado(a) à ${d.respEndereco || 'Endereço cadastrado na secretaria'}, ${d.respCidadeUf || d.escolaCidadeUf}, telefone/WhatsApp: ${d.respTelefone || 'Não informado'}, e-mail: ${d.respEmail || 'Não informado'}, doravante denominado(a) CONTRATANTE.

BENEFICIÁRIO(A) / ALUNO(A): ${d.alunoNome.toUpperCase()}${d.alunoCpf ? `, CPF nº ${d.alunoCpf}` : ''}${d.alunoDataNasc ? `, Data de Nasc.: ${d.alunoDataNasc}` : ''}, matriculado(a) sob o nº ${d.alunoMatricula || 'A definir'}, cursando ${d.alunoSerie || d.alunoTurma || 'Educação Básica'}, Turno: ${d.alunoTurno || 'Matutino'}, doravante denominado(a) ALUNO.

Têm entre si justo e avençado o presente Contrato de Prestação de Serviços Educacionais, que se regerá pelas disposições da Lei Federal nº 9.870/1999, Lei Federal nº 8.078/1990 (Código de Defesa do Consumidor), Lei Federal nº 9.394/1996 (LDB) e pelas cláusulas seguintes:

CLÁUSULA 1ª – DO OBJETO
O objeto do presente contrato é a prestação de serviços educacionais pela CONTRATADA em favor do(a) ALUNO(A) beneficiário(a), para o ano letivo de ${d.anoLetivo}, em conformidade com o Projeto Político-Pedagógico e Regimento Escolar da instituição de ensino.

CLÁUSULA 2ª – DA ANUIDADE ESCOLAR E FORMA DE PAGAMENTO
Pela prestação dos serviços educacionais contratados, o(a) CONTRATANTE pagará à CONTRATADA uma anuidade no valor total de ${anuidadeStr}, dividida em ${d.numParcelas} (doze) parcelas mensais e consecutivas no valor de ${mensalidadeStr} cada uma, com vencimento no dia ${d.diaVencimento} de cada mês civil.
Parágrafo Primeiro: Caso tenha sido concedido percentual de desconto (${descontoStr}), este possui caráter de pontualidade, sendo válido exclusivamente se o pagamento for realizado rigorosamente até a data limite do vencimento.
Parágrafo Segundo: A primeira parcela, correspondente à matrícula ou rematrícula, formaliza o compromisso e reserva da vaga.

CLÁUSULA 3ª – DA MORA E DO INADIMPLEMENTO
O não pagamento de qualquer parcela até a data de vencimento sujeitará o(a) CONTRATANTE ao pagamento de:
a) Multa moratória de 2% (dois por cento) sobre o valor da parcela em atraso, consoante o art. 52, § 1º do Código de Defesa do Consumidor;
b) Juros moratórios de 1% (um por cento) ao mês, calculados pro rata die da data do vencimento até o efetivo pagamento;
c) Atualização monetária com base no índice oficial (IPCA/IBGE).
Parágrafo Único: Em caso de inadimplência superior a 30 (trinta) dias, a CONTRATADA poderá encaminhar o débito para cobrança administrativa ou judicial, bem como proceder ao registro do débito nos órgãos de proteção ao crédito (SPC/Serasa), após prévia notificação.

CLÁUSULA 4ª – DOS SERVIÇOS NÃO INCLUSOS
Não estão inclusos no valor da anuidade escolar os custos relativos a: uniformes, materiais didáticos e apostilas de uso pessoal do aluno, transporte escolar, alimentação na cantina, exames de 2ª chamada, atividades extracurriculares optativas e passeios de estudo.

CLÁUSULA 5ª – DA RESCISÃO E CANCELAMENTO
A rescisão deste contrato por iniciativa do(a) CONTRATANTE antes do início das aulas garantirá a restituição proporcional dos valores pagos, retendo-se até 20% (vinte por cento) a título de despesas administrativas de processamento de matrícula. Após o início do período letivo, a desistência ou transferência implicará o pagamento das parcelas vencidas e da competência em curso até a data do protocolo formal da solicitação de transferência.

CLÁUSULA 6ª – DO USO DE IMAGEM E VOZ
O(A) CONTRATANTE expressamente autoriza a CONTRATADA a utilizar, sem qualquer ônus, a imagem e a voz do(a) ALUNO(A) para fins exclusivamente pedagógicos, educacionais e de divulgação institucional da escola (redes sociais oficiais, site, murais, anuários e campanhas comemorativas), vedada qualquer utilização desrespeitosa ou ofensiva.

CLÁUSULA 7ª – DA PROTEÇÃO DE DADOS (LGPD)
As partes declaram ciência e concordância quanto à coleta e ao tratamento de dados pessoais do CONTRATANTE e do ALUNO, em conformidade com a Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD), com a finalidade exclusiva de cumprimento de obrigações legais, relatórios ao Ministério da Educação/Censo Escolar e execução deste contrato educacional.

CLÁUSULA 8ª – DA VALIDADE DA ASSINATURA ELETRÔNICA E FORO
As partes reconhecem expressamente a plena validade jurídica, autenticidade e eficácia executiva do presente instrumento firmado por meio de assinatura eletrônica digital certificada via plataforma ZapSign, nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020.
E, por estarem justos e contratados, elegem o Foro da Comarca de ${d.escolaCidadeUf} para dirimir quaisquer dúvidas ou litígios decorrentes deste instrumento.`
}

/**
 * Gera o texto legal do Requerimento de Matrícula
 */
export function getTextoRequerimentoMatricula(d: ContractDataModel): string {
  return `REQUERIMENTO DE MATRÍCULA ESCOLAR – ANO LETIVO ${d.anoLetivo}

À Direção e Secretaria do ${d.escolaNome.toUpperCase()}

Eu, ${d.respNome.toUpperCase()}, portador(a) do CPF nº ${d.respCpf}${d.respRg ? ` e RG nº ${d.respRg}` : ''}, na qualidade de Responsável Legal (${d.respParentesco || 'Responsável'}), venho respeitosamente REQUERER a matrícula/rematrícula do(a) estudante abaixo qualificado(a) para o Ano Letivo de ${d.anoLetivo}:

DADOS DO(A) ESTUDANTE:
• Nome Completo: ${d.alunoNome.toUpperCase()}
• Data de Nascimento: ${d.alunoDataNasc || 'Constante no prontuário'}
• Matrícula/Código: ${d.alunoMatricula || 'Pendente'}
• Série / Ano Escolar pretendido: ${d.alunoSerie || d.alunoTurma || 'Conforme histórico'}
• Turno: ${d.alunoTurno || 'Matutino'}

TERMO DE COMPROMISSO E DECLARAÇÕES:
1. Declaro serem autênticas e verdadeiras todas as informações e documentos apresentados no ato da matrícula.
2. Comprometo-me a respeitar e fazer respeitar o Regimento Escolar, os horários de entrada e saída e o calendário pedagógico da instituição.
3. Comprometo-me a manter permanentemente atualizados perante a Secretaria Escolar os números de telefone celular, WhatsApp, e-mail e endereço de residência para comunicações e eventuais urgências médicas.
4. Declaro ciência de que a confirmação definitiva da matrícula está vinculada ao cumprimento dos requisitos pedagógicos, entrega da documentação escolar legal (Histórico Escolar/Transferência) e adimplemento das obrigações contratuais.

Por ser a expressão da verdade, firmo o presente requerimento para que produza os regulares efeitos de direito.`
}
