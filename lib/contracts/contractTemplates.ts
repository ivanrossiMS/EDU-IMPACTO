/**
 * lib/contracts/contractTemplates.ts
 *
 * Modelos jurídicos e de secretaria para Matrículas e Termos de Ciência Digitais.
 * Focado na formalização de matrícula, ciência das normas pedagógicas,
 * autorizações institucionais e conformidade com a MP 2.200-2/01 e Lei 14.063/20.
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
  escolaLogoBase64?: string | null
  escolaLogoBytes?: Uint8Array | null

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

  // Responsável Legal / Signatário
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

  // Condições e Autorizações
  anoLetivo: string
  tipoDocumento: 'requerimento_matricula' | 'termo_ciencia' | 'contrato_adesao' | 'contrato_servicos' | 'personalizado'
  conteudoPersonalizado?: string
  autorizacoesSelecionadas?: string[]

  // Condições financeiras opcionais (não obrigatórias)
  valorAnuidade?: number
  valorMensalidade?: number
  numParcelas?: number
  descontoPercent?: number
  diaVencimento?: number
  primeiroVencimento?: string
}

/**
 * Formata moeda BRL
 */
export function formatCurrencyBRL(val?: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

/**
 * Gera o texto legal do Requerimento de Matrícula e Ciência Escolar
 */
export function getTextoRequerimentoMatricula(d: ContractDataModel): string {
  const escolaRazao = (d.escolaRazaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA').toUpperCase()
  const escolaCnpj = d.escolaCnpj || '04.395.789/0001-88'
  const escolaEnd = d.escolaEndereco || 'Rua da Divisão, 586, Parati'
  const escolaCidUf = d.escolaCidadeUf || 'Campo Grande - MS'
  const respNome = (d.respNome || 'Responsável Legal').toUpperCase()
  const alunoNome = (d.alunoNome || 'Estudante').toUpperCase()

  return `REQUERIMENTO DE MATRÍCULA ESCOLAR E TERMO DE CIÊNCIA – ANO LETIVO ${d.anoLetivo || '2027'}

I – DADOS DA INSTITUIÇÃO DE ENSINO
ESCOLA: ${escolaRazao}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${escolaCnpj}, com sede à ${escolaEnd}, ${escolaCidUf}, doravante denominada simplesmente ESCOLA.

II – DADOS DO RESPONSÁVEL LEGAL
RESPONSÁVEL: ${respNome}, inscrito(a) no CPF sob o nº ${d.respCpf || 'Não informado'}${d.respRg ? `, RG nº ${d.respRg}` : ''}, telefone/WhatsApp: ${d.respTelefone || 'Não informado'}, e-mail: ${d.respEmail || 'Não informado'}, residente e domiciliado(a) em ${d.respCidadeUf || escolaCidUf}, na qualidade de Responsável Legal (${d.respParentesco || 'Responsável'}).

III – DADOS DO(A) ESTUDANTE BENEFICIÁRIO(A)
ESTUDANTE: ${alunoNome}${d.alunoCpf ? `, CPF nº ${d.alunoCpf}` : ''}${d.alunoDataNasc ? `, Data de Nasc.: ${d.alunoDataNasc}` : ''}, cursando ${d.alunoSerie || d.alunoTurma || 'Educação Básica'}, Turno: ${d.alunoTurno || 'Matutino'}, Matrícula/Cód: ${d.alunoMatricula || 'Pendente'}.

IV – TERMO DE CIÊNCIA, COMPROMISSO E AUTORIZAÇÕES:
1. CIÊNCIA DO REGIMENTO ESCOLAR: O(A) Responsável declara ter conhecimento e manifesta expressa concordância com as normas regimentais, proposta pedagógica, calendário letivo e horários de entrada e saída estabelecidos pelo Colégio Impacto.
2. VERACIDADE DAS INFORMAÇÕES: Declara serem autênticas, completas e verdadeiras todas as informações e documentos escolares apresentados para a formalização deste vínculo.
3. CANAIS DE COMUNICAÇÃO: Compromete-se a manter permanentemente atualizados perante a Secretaria Escolar os números de telefone, WhatsApp, e-mail e endereço residencial para todas as notificações institucionais.
4. AUTORIZAÇÃO DE USO DE IMAGEM E VOZ: O(A) Responsável autoriza o Colégio Impacto a utilizar, a título gratuito, a imagem e a voz do(a) estudante para fins pedagógicos e de divulgação institucional em murais, anuários, redes sociais oficiais e site da escola.
5. SAÍDAS PEDAGÓGICAS E ATIVIDADES EXTERNAS: Autoriza a participação do(a) estudante em atividades extraclasse, projetos interdisciplinares e visitas pedagógicas devidamente programadas e comunicadas com antecedência.
6. TRATAMENTO DE DADOS PESSOAIS (LGPD): As partes declaram ciência quanto ao tratamento de dados pessoais do estudante e responsáveis, em estrita conformidade com a Lei Federal nº 13.709/2018 (LGPD), para cumprimento de obrigações legais, registros acadêmicos e Censo Escolar.

V – DA VALIDADE DA ASSINATURA ELETRÔNICA DO IMPACTO EDU
As partes contratantes reconhecem expressamente como plenamente válida, autêntica, íntegra e dotada de força probante e executiva a assinatura eletrônica gerada e certificada pela plataforma do Colégio Impacto (Impacto EDU), nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020. As partes anuem expressamente que as evidências técnicas registradas (código de verificação OTP enviado ao e-mail/WhatsApp, endereço IP, carimbo de data e hora UTC, metadados de dispositivo e navegador, e hash criptográfico SHA-256 do documento) constituem prova idônea de autoria, integridade e consentimento das obrigações pactuadas.

E, por estarem plenamente cientes e de acordo, elegem o Foro da Comarca de ${escolaCidUf} para dirimir quaisquer dúvidas decorrentes deste instrumento.`
}

/**
 * Gera o texto do Termo de Ciência e Autorizações Gerais
 */
export function getTextoTermoCienciaEAutorizacoes(d: ContractDataModel): string {
  const escolaRazao = (d.escolaRazaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA').toUpperCase()
  const escolaCnpj = d.escolaCnpj || '04.395.789/0001-88'
  const respNome = (d.respNome || 'Responsável Legal').toUpperCase()
  const alunoNome = (d.alunoNome || 'Estudante').toUpperCase()

  return `TERMO DE CIÊNCIA, AUTORIZAÇÕES E DECLARAÇÕES – ANO LETIVO ${d.anoLetivo || '2027'}

INSTITUIÇÃO: ${escolaRazao} • CNPJ: ${escolaCnpj}
ESTUDANTE: ${alunoNome} (${d.alunoSerie || d.alunoTurma || 'Regular'})
RESPONSÁVEL: ${respNome} • CPF: ${d.respCpf || 'Não informado'} • Tel: ${d.respTelefone || ''}

Pelo presente instrumento, o(a) Responsável Legal acima qualificado(a) manifesta expressa CIÊNCIA, CONCORDÂNCIA E AUTORIZAÇÃO em relação aos seguintes termos perante o Colégio Impacto:

1. MANIFESTAÇÃO DE CIÊNCIA PEDAGÓGICA:
Declaro ter tomado ciência do Projeto Político-Pedagógico, do Regimento Escolar e das diretrizes disciplinares e de convivência escolar da instituição de ensino para o ano letivo de ${d.anoLetivo || '2027'}.

2. AUTORIZAÇÃO DE ATIVIDADES E SAÍDAS PEDAGÓGICAS:
Autorizo o(a) estudante a participar das atividades cívicas, culturais, esportivas e passeios pedagógicos promovidos pelo Colégio Impacto no decorrer do ano letivo.

3. USO DE IMAGEM INSTITUCIONAL:
Autorizo expressamente a veiculação da imagem e voz do(a) estudante em materiais institucionais, eventos acadêmicos, campanhas pedagógicas e mídias sociais oficiais do Colégio Impacto, resguardados o respeito e a dignidade do educando.

4. COMUNICAÇÃO OFICIAL E AGENDA DIGITAL:
Declaro estar ciente de que as comunicações escolares, boletins, avisos de rotina e circulares serão encaminhados preferencialmente por meio eletrônico e da Agenda Digital do Impacto EDU.

5. VALIDADE JURÍDICA DA ASSINATURA ELETRÔNICA:
Declaro ciência e reconheço a plena validade, autenticidade e eficácia jurídica da assinatura eletrônica realizada pela plataforma do Colégio Impacto (Impacto EDU), nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, concordando com o registro pericial das evidências técnicas (código OTP enviado por e-mail/WhatsApp, endereço IP, metadados de hardware e hash SHA-256).

Por ser a expressão da minha livre e consciente vontade, firmo o presente termo para que produza todos os seus efeitos legais.`
}
