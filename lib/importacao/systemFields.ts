import { SystemFieldDef } from './types'

export const SYSTEM_FIELDS: SystemFieldDef[] = [
  // --- ALUNO ---
  {
    value: 'aluno_codigo',
    label: 'Matrícula / ID Aluno',
    category: 'aluno',
    aliases: ['matricula', 'ra', 'codigo', 'cod', 'id_aluno', 'rm', 'cd_aluno', 'cod_aluno', 'num_matricula', 'id aluno', 'id', 'matr']
  },
  {
    value: 'aluno_nome',
    label: 'Nome Completo do Aluno',
    category: 'aluno',
    required: true,
    aliases: ['nome completo aluno', 'nome do aluno', 'nome aluno', 'aluno', 'estudante', 'nm_aluno', 'nome completo', 'nome', 'discente']
  },
  {
    value: 'aluno_data_nascimento',
    label: 'Data de Nascimento Aluno',
    category: 'aluno',
    aliases: ['data nascimento', 'data de nascimento', 'nascimento', 'dt_nasc', 'dtnasc', 'dt_nascimento', 'data_nasc', 'aniversario', 'data nascimento aluno']
  },
  {
    value: 'aluno_sexo',
    label: 'Sexo / Gênero Aluno',
    category: 'aluno',
    aliases: ['sexo', 'genero', 'sx', 'sexo aluno', 'genero aluno']
  },
  {
    value: 'aluno_cpf',
    label: 'CPF Aluno',
    category: 'aluno',
    aliases: ['cpf aluno', 'cpf do aluno', 'cpf estudante', 'cpf']
  },
  {
    value: 'aluno_rg',
    label: 'RG Aluno',
    category: 'aluno',
    aliases: ['rg aluno', 'rg do aluno', 'rg']
  },
  {
    value: 'aluno_telefone',
    label: 'Telefone / Celular Aluno',
    category: 'aluno',
    aliases: ['telefone aluno', 'celular aluno', 'tel aluno', 'cel aluno', 'contato aluno', 'whatsapp aluno', 'fone aluno', 'celular']
  },
  {
    value: 'aluno_email',
    label: 'E-mail Aluno',
    category: 'aluno',
    aliases: ['email aluno', 'e-mail aluno', 'mail aluno', 'email', 'e-mail']
  },
  {
    value: 'aluno_turma',
    label: 'Turma (ex: 5º Ano A)',
    category: 'aluno',
    aliases: ['turma', 'classe', 'turma atual', 'cod_turma', 'sigla_turma', 'turma aluno']
  },
  {
    value: 'aluno_serie',
    label: 'Série / Ano Escolar',
    category: 'aluno',
    aliases: ['serie', 'ano escolar', 'ano serie', 'grau', 'etapa ano', 'ano']
  },
  {
    value: 'aluno_segmento',
    label: 'Segmento (ex: Fundamental I)',
    category: 'aluno',
    aliases: ['segmento', 'nivel', 'etapa', 'ciclo', 'segmento escolar']
  },
  {
    value: 'aluno_turno',
    label: 'Turno (Matutino / Vespertino)',
    category: 'aluno',
    aliases: ['turno', 'periodo', 'horario', 'turno aluno']
  },
  {
    value: 'aluno_ano_letivo',
    label: 'Ano Letivo',
    category: 'aluno',
    aliases: ['ano letivo', 'ano_letivo', 'exercicio', 'ano exercicio']
  },
  {
    value: 'aluno_ativo',
    label: 'Aluno Ativo (Sim/Não)',
    category: 'aluno',
    aliases: ['aluno ativo', 'ativo', 'status', 'situacao', 'status matricula', 'sit_matr', 'matriculado']
  },
  {
    value: 'aluno_autorizadoSairSozinho',
    label: 'Pode Sair Sozinho (Sim/Não)',
    category: 'aluno',
    aliases: ['pode sair sozinho', 'sair sozinho', 'pode sair', 'saida desacompanhada', 'autorizado sair sozinho', 'saida sozinho']
  },
  {
    value: 'aluno_isIntegralIntermediario',
    label: 'Integral / Intermediário',
    category: 'aluno',
    aliases: ['integral/intermediario', 'integral', 'intermediario', 'periodo integral', 'modalidade']
  },

  // --- ENDEREÇO ---
  {
    value: 'aluno_cep',
    label: 'CEP',
    category: 'endereco',
    aliases: ['cep', 'cep endereco', 'cep aluno', 'cd_cep']
  },
  {
    value: 'aluno_endereco',
    label: 'Logradouro / Endereço',
    category: 'endereco',
    aliases: ['logradouro/endereco', 'logradouro', 'endereco', 'rua', 'end', 'endereco aluno']
  },
  {
    value: 'aluno_numero',
    label: 'Número Endereço',
    category: 'endereco',
    aliases: ['numero endereco', 'numero', 'num', 'nro']
  },
  {
    value: 'aluno_bairro',
    label: 'Bairro',
    category: 'endereco',
    aliases: ['bairro', 'bair', 'bairro aluno']
  },
  {
    value: 'aluno_cidade',
    label: 'Cidade',
    category: 'endereco',
    aliases: ['cidade', 'municipio', 'cidade aluno']
  },
  {
    value: 'aluno_uf',
    label: 'Estado (UF)',
    category: 'endereco',
    aliases: ['estado (uf)', 'uf', 'estado', 'uf aluno']
  },

  // --- MÃE / RESPONSÁVEL 1 ---
  {
    value: 'resp1_nome',
    label: 'Nome Mãe / Resp. 1',
    category: 'resp1',
    aliases: ['nome mae', 'mae', 'nome da mae', 'filiacao 1', 'nm_mae', 'resp 1', 'responsavel 1', 'nome resp 1', 'nome responsavel 1', 'nome responsavel', 'filiacao mae']
  },
  {
    value: 'resp1_parentesco',
    label: 'Parentesco Resp. 1 (ex: Mãe)',
    category: 'resp1',
    aliases: ['parentesco mae', 'parentesco 1', 'grau 1', 'parentesco resp 1', 'parentesco']
  },
  {
    value: 'resp1_cpf',
    label: 'CPF Mãe / Resp. 1',
    category: 'resp1',
    aliases: ['cpf mae', 'cpf da mae', 'cpf resp 1', 'cpf responsavel 1', 'cpf resp', 'cpf responsavel']
  },
  {
    value: 'resp1_telefone',
    label: 'Telefone/Celular Mãe / Resp. 1',
    category: 'resp1',
    aliases: ['telefone mae', 'celular mae', 'tel mae', 'cel mae', 'fone mae', 'whatsapp mae', 'celular resp 1', 'telefone resp 1', 'tel resp 1', 'telefone resp', 'celular resp']
  },
  {
    value: 'resp1_email',
    label: 'E-mail Mãe / Resp. 1',
    category: 'resp1',
    aliases: ['email mae', 'e-mail mae', 'email resp 1', 'email responsavel 1', 'email resp', 'email responsavel']
  },
  {
    value: 'resp1_profissao',
    label: 'Profissão Mãe / Resp. 1',
    category: 'resp1',
    aliases: ['profissao mae', 'profissao 1', 'profissao resp 1', 'ocupacao mae', 'profissao']
  },
  {
    value: 'resp1_rfid',
    label: 'RFID / Cartão Resp. 1',
    category: 'resp1',
    aliases: ['rfid mae', 'rfid 1', 'cartao mae', 'cracha mae', 'rfid', 'rfid resp 1']
  },
  {
    value: 'resp1_financeiro',
    label: 'Resp. 1 é Financeiro? (Sim/Não)',
    category: 'resp1',
    aliases: ['resp financeiro 1', 'financeiro mae', 'financeiro 1', 'resp financeiro', 'financeiro']
  },
  {
    value: 'resp1_pedagogico',
    label: 'Resp. 1 é Pedagógico? (Sim/Não)',
    category: 'resp1',
    aliases: ['resp pedagogico 1', 'pedagogico mae', 'pedagogico 1', 'resp pedagogico', 'pedagogico']
  },
  {
    value: 'resp1_retirar',
    label: 'Resp. 1 Autorizado Retirar? (Sim/Não)',
    category: 'resp1',
    aliases: ['autorizado retirar mae', 'autorizado retirar 1', 'retirar mae', 'retirada 1', 'autorizado retirar']
  },

  // --- PAI / RESPONSÁVEL 2 ---
  {
    value: 'resp2_nome',
    label: 'Nome Pai / Resp. 2',
    category: 'resp2',
    aliases: ['nome pai', 'pai', 'nome do pai', 'filiacao 2', 'nm_pai', 'resp 2', 'responsavel 2', 'nome resp 2', 'nome responsavel 2', 'filiacao pai']
  },
  {
    value: 'resp2_parentesco',
    label: 'Parentesco Resp. 2 (ex: Pai)',
    category: 'resp2',
    aliases: ['parentesco pai', 'parentesco 2', 'grau 2', 'parentesco resp 2']
  },
  {
    value: 'resp2_cpf',
    label: 'CPF Pai / Resp. 2',
    category: 'resp2',
    aliases: ['cpf pai', 'cpf do pai', 'cpf resp 2', 'cpf responsavel 2']
  },
  {
    value: 'resp2_telefone',
    label: 'Telefone/Celular Pai / Resp. 2',
    category: 'resp2',
    aliases: ['telefone pai', 'celular pai', 'tel pai', 'cel pai', 'fone pai', 'whatsapp pai', 'celular resp 2', 'telefone resp 2', 'tel resp 2']
  },
  {
    value: 'resp2_email',
    label: 'E-mail Pai / Resp. 2',
    category: 'resp2',
    aliases: ['email pai', 'e-mail pai', 'email resp 2', 'email responsavel 2']
  },
  {
    value: 'resp2_profissao',
    label: 'Profissão Pai / Resp. 2',
    category: 'resp2',
    aliases: ['profissao pai', 'profissao 2', 'profissao resp 2']
  },
  {
    value: 'resp2_rfid',
    label: 'RFID / Cartão Resp. 2',
    category: 'resp2',
    aliases: ['rfid pai', 'rfid 2', 'cartao pai', 'cracha pai']
  },
  {
    value: 'resp2_financeiro',
    label: 'Resp. 2 é Financeiro? (Sim/Não)',
    category: 'resp2',
    aliases: ['resp financeiro 2', 'financeiro pai', 'financeiro 2']
  },
  {
    value: 'resp2_pedagogico',
    label: 'Resp. 2 é Pedagógico? (Sim/Não)',
    category: 'resp2',
    aliases: ['resp pedagogico 2', 'pedagogico pai', 'pedagogico 2']
  },
  {
    value: 'resp2_retirar',
    label: 'Resp. 2 Autorizado Retirar? (Sim/Não)',
    category: 'resp2',
    aliases: ['autorizado retirar pai', 'autorizado retirar 2', 'retirar pai', 'retirada 2']
  }
]
