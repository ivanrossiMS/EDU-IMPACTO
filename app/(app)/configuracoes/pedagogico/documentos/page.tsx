'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import {
  Plus, Search, X, Check, Upload, Download, Eye, Play, FileText,
  Trash2, Pencil, Clock, AlertTriangle, BookOpen,
  Tag, RefreshCw, Shield, Link2, Wand2, ChevronDown, Zap
} from 'lucide-react'
import * as XLSX from 'xlsx'


// ─── Types ────────────────────────────────────────────────────────────────────
interface Mascara {
  codigo: string
  descricao: string
  categoria?: string
  ativo: boolean
}

// Mapeamento salvo pelo usuário: qual campo do sistema cada máscara representa
interface MapeamentoUsuario {
  codigoMascara: string           // <<minha_mascara>>
  fonte: 'aluno' | 'turma' | 'escola' | 'data' | 'fixo' | 'mae' | 'pai' | 'resp_ped' | 'resp_fin' | 'financeiro' | 'parcela'
  campo: string                   // nome do campo (ex: "nome", "cpf", "data_hoje")
  valorFixo?: string              // para fonte=fixo
}

// Catálogo COMPLETO de campos disponíveis — fonte: análise de dataContext.tsx + todas as páginas
const CAMPOS_DISPONIVEIS: { grupo: string; fonte: MapeamentoUsuario['fonte']; icone?: string; campos: { campo: string; label: string; exemplo: string; caminho?: string }[] }[] = [
  { grupo: 'Aluno — Identificação', fonte: 'aluno', icone: '👤', campos: [
    { campo: 'nome',                 label: 'Nome completo',                  exemplo: 'João Pedro da Silva',      caminho: 'Acadêmico → Alunos' },
    { campo: 'matricula',            label: 'Número de matrícula',            exemplo: '20260001',                 caminho: 'Acadêmico → Alunos' },
    { campo: 'rga',                  label: 'RGA',                            exemplo: '20260001234',               caminho: 'Acadêmico → Alunos' },
    { campo: 'idCenso',              label: 'ID Censo Escolar',               exemplo: '12345678901',               caminho: 'Relatórios → Censo' },
    { campo: 'cpf',                  label: 'CPF do aluno',                   exemplo: '123.456.789-00',           caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'rg',                   label: 'RG do aluno',                    exemplo: '12.345.678-9',             caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'orgEmissorRg',         label: 'Orgão emissor RG',               exemplo: 'SSP/SP',                   caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'dataNascimento',       label: 'Data de nascimento',             exemplo: '15/03/2010',               caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'sexo',                 label: 'Sexo',                           exemplo: 'Masculino',                caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'racaCor',              label: 'Raça/Cor',                       exemplo: 'Pardo',                    caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'estadoCivil',          label: 'Estado civil',                   exemplo: 'Solteiro(a)',              caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'nacionalidade',        label: 'Nacionalidade',                  exemplo: 'Brasileira',               caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'naturalidade',         label: 'Naturalidade',                   exemplo: 'São Paulo/SP',             caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'uf',                   label: 'UF de nascimento',               exemplo: 'SP',                       caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'religiao',             label: 'Religião',                       exemplo: 'Católica',                 caminho: 'Acadêmico → Alunos → Dados Pessoais' },
    { campo: 'filiacaoMae',          label: 'Filiação — Mãe',                exemplo: 'Ana Maria da Silva',      caminho: 'Acadêmico → Alunos → Filiação' },
    { campo: 'filiacaoPai',          label: 'Filiação — Pai',                exemplo: 'José Carlos da Silva',    caminho: 'Acadêmico → Alunos → Filiação' },
  ]},
  { grupo: 'Aluno — Contato e Endereço', fonte: 'aluno', icone: '📍', campos: [
    { campo: 'email',                label: 'E-mail do aluno',                exemplo: 'joao@email.com',           caminho: 'Acadêmico → Alunos → Contato' },
    { campo: 'celular',              label: 'Celular',                        exemplo: '(11) 99999-9999',          caminho: 'Acadêmico → Alunos → Contato' },
    { campo: 'telefone',             label: 'Telefone fixo',                  exemplo: '(11) 3333-4444',           caminho: 'Acadêmico → Alunos → Contato' },
    { campo: 'telefoneResponsavel',  label: 'Telefone do responsável',        exemplo: '(11) 98888-8888',          caminho: 'Acadêmico → Alunos → Contato' },
    { campo: 'endereco',             label: 'Endereço (linha única)',         exemplo: 'Rua das Flores, 123',      caminho: 'Acadêmico → Alunos → Endereço' },
    { campo: 'logradouro',           label: 'Logradouro',                     exemplo: 'Rua das Flores',           caminho: 'Acadêmico → Alunos → Endereço' },
    { campo: 'numero',               label: 'Número',                         exemplo: '123',                      caminho: 'Acadêmico → Alunos → Endereço' },
    { campo: 'complemento',          label: 'Complemento',                    exemplo: 'Apto 4',                   caminho: 'Acadêmico → Alunos → Endereço' },
    { campo: 'bairro',               label: 'Bairro',                         exemplo: 'Centro',                   caminho: 'Acadêmico → Alunos → Endereço' },
    { campo: 'cidadeEnd',            label: 'Cidade (endereço)',              exemplo: 'São Paulo',                caminho: 'Acadêmico → Alunos → Endereço' },
    { campo: 'cep',                  label: 'CEP',                            exemplo: '01310-100',                caminho: 'Acadêmico → Alunos → Endereço' },
    { campo: 'estadoEnd',            label: 'Estado/UF (endereço)',          exemplo: 'SP',                       caminho: 'Acadêmico → Alunos → Endereço' },
  ]},
  { grupo: 'Aluno — Situação Escolar', fonte: 'aluno', icone: '📚', campos: [
    { campo: 'turma',                label: 'Nome da turma',                  exemplo: '7º Ano A',                 caminho: 'Acadêmico → Alunos' },
    { campo: 'serie',                label: 'Série/Ano',                      exemplo: '7º Ano',                   caminho: 'Acadêmico → Alunos' },
    { campo: 'turno',                label: 'Turno',                          exemplo: 'Manhã',                    caminho: 'Acadêmico → Alunos' },
    { campo: 'status',               label: 'Status de matrícula',            exemplo: 'Matriculado',              caminho: 'Acadêmico → Alunos' },
    { campo: 'unidade',              label: 'Unidade escolar',                exemplo: 'Colégio Impacto',          caminho: 'Acadêmico → Alunos' },
    { campo: 'frequencia',           label: 'Percentual de frequência',       exemplo: '92',                       caminho: 'Acadêmico → Frequência' },
    { campo: 'media',                label: 'Média geral',                    exemplo: '7.8',                      caminho: 'Acadêmico → Notas' },
    { campo: 'obs',                  label: 'Observações gerais do aluno',    exemplo: 'Aluno bolsista',           caminho: 'Acadêmico → Alunos → Observações' },
    { campo: 'responsavel',          label: 'Nome do responsável ped.',       exemplo: 'Maria Aparecida da Silva', caminho: 'Acadêmico → Responsáveis' },
  ]},
  { grupo: 'Aluno — Saúde', fonte: 'aluno', icone: '🏥', campos: [
    { campo: 'tipoSanguineo',        label: 'Tipo sanguíneo',                 exemplo: 'A+',                       caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'alergias',             label: 'Alergias',                       exemplo: 'Amendoim, Penicilina',     caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'medicamentos',         label: 'Medicamentos em uso',            exemplo: 'Ritalina 10mg',            caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'condicoesSaude',       label: 'Condições de saúde',            exemplo: 'TDAH',                     caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'planoSaude',           label: 'Plano de saúde',                exemplo: 'Unimed',                   caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'numCarteirinha',       label: 'Nº Carteirinha do plano',        exemplo: '12345678',                 caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'medico',               label: 'Médico responsável',             exemplo: 'Dr. Carlos Augusto',       caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'contMedico',           label: 'Contato do médico',              exemplo: '(11) 3200-0000',           caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'deficiencia',          label: 'Deficiência declarada',          exemplo: 'Nenhuma',                  caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
    { campo: 'necessidadeEspecial',  label: 'Necessidade especial / NEE',     exemplo: 'Dislexia',                 caminho: 'Acadêmico → Alunos → Ficha de Saúde' },
  ]},
  { grupo: 'Mãe', fonte: 'mae', icone: '👩', campos: [
    { campo: 'nome',            label: 'Nome completo',           exemplo: 'Ana Maria da Silva',   caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'cpf',             label: 'CPF',                     exemplo: '111.222.333-44',       caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'rg',              label: 'RG',                      exemplo: '11.222.333-4',         caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'orgEmissorRg',    label: 'Órgão emissor RG',       exemplo: 'SSP/SP',               caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'celular',         label: 'Celular',                 exemplo: '(11) 91111-1111',      caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'telefone',        label: 'Telefone fixo',           exemplo: '(11) 3000-0000',      caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'email',           label: 'E-mail',                  exemplo: 'mae@email.com',        caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'profissao',       label: 'Profissão',               exemplo: 'Professora',           caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'empresa',         label: 'Empresa/Empregadora',     exemplo: 'Escola Municipal',     caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'naturalidade',    label: 'Naturalidade',            exemplo: 'Santos/SP',            caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'uf',              label: 'UF',                      exemplo: 'SP',                   caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'nacionalidade',   label: 'Nacionalidade',           exemplo: 'Brasileira',           caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'estadoCivil',     label: 'Estado civil',            exemplo: 'Casada',               caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'renda',           label: 'Renda mensal',            exemplo: 'R$ 3.500,00',          caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'grauInstrucao',   label: 'Grau de instrução',      exemplo: 'Superior Completo',    caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'falecida',        label: 'Falecida',                exemplo: 'Não',                  caminho: 'Acadêmico → Alunos → Código → Filiação' },
  ]},
  { grupo: 'Pai', fonte: 'pai', icone: '👨', campos: [
    { campo: 'nome',            label: 'Nome completo',           exemplo: 'Jose Carlos da Silva', caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'cpf',             label: 'CPF',                     exemplo: '555.666.777-88',       caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'rg',              label: 'RG',                      exemplo: '55.666.777-8',         caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'orgEmissorRg',    label: 'Órgão emissor RG',       exemplo: 'SSP/SP',               caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'celular',         label: 'Celular',                 exemplo: '(11) 92222-2222',      caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'email',           label: 'E-mail',                  exemplo: 'pai@email.com',        caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'profissao',       label: 'Profissão',               exemplo: 'Engenheiro',           caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'empresa',         label: 'Empresa/Empregadora',     exemplo: 'AutoPeças SA',         caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'naturalidade',    label: 'Naturalidade',            exemplo: 'Rio de Janeiro/RJ',    caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'estadoCivil',     label: 'Estado civil',            exemplo: 'Casado',               caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'renda',           label: 'Renda mensal',            exemplo: 'R$ 7.000,00',          caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'grauInstrucao',   label: 'Grau de instrução',      exemplo: 'Superior Completo',    caminho: 'Acadêmico → Alunos → Código → Filiação' },
    { campo: 'falecido',        label: 'Falecido',                exemplo: 'Não',                  caminho: 'Acadêmico → Alunos → Código → Filiação' },
  ]},
  { grupo: 'Responsável Pedagógico', fonte: 'resp_ped', icone: '📚', campos: [
    { campo: 'nome',              label: 'Nome completo',             exemplo: 'Ana Maria da Silva',   caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'cpf',               label: 'CPF',                       exemplo: '111.222.333-44',       caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'rg',                label: 'RG',                        exemplo: '11.222.333-4',         caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'orgEmissorRg',      label: 'Órgão emissor RG',         exemplo: 'SSP/SP',               caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'celular',           label: 'Celular',                   exemplo: '(11) 91111-1111',      caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'email',             label: 'E-mail',                    exemplo: 'resp@email.com',       caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'parentesco',        label: 'Grau de parentesco',        exemplo: 'Mãe',                  caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'codigo',            label: 'Código do responsável',     exemplo: '1001',                 caminho: 'Acadêmico → Responsáveis' },
    { campo: 'profissao',         label: 'Profissão',                 exemplo: 'Professora',           caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'telefoneComercial', label: 'Telefone comercial',        exemplo: '(11) 3200-0000',      caminho: 'Acadêmico → Responsáveis → Pedagógico' },
    { campo: 'autorizacaoSaida',  label: 'Autorizado a buscar aluno',exemplo: 'Sim',                  caminho: 'Acadêmico → Responsáveis → Pedagógico' },
  ]},
  { grupo: 'Responsável Financeiro', fonte: 'resp_fin', icone: '💰', campos: [
    { campo: 'nome',        label: 'Nome completo',             exemplo: 'Jose Carlos da Silva', caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'cpf',         label: 'CPF',                       exemplo: '555.666.777-88',       caminho: 'Financeiro → Contas a Receber' },
    { campo: 'rg',          label: 'RG',                        exemplo: '55.666.777-8',         caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'orgEmissorRg',label: 'Órgão emissor RG',         exemplo: 'SSP/SP',               caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'celular',     label: 'Celular',                   exemplo: '(11) 92222-2222',      caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'email',       label: 'E-mail',                    exemplo: 'fin@email.com',        caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'parentesco',  label: 'Grau de parentesco',        exemplo: 'Pai',                  caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'codigo',      label: 'Código',                    exemplo: '1002',                 caminho: 'Acadêmico → Responsáveis' },
    { campo: 'logradouro',  label: 'Logradouro (boleto)',       exemplo: 'Av. Paulista',         caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'numero',      label: 'Número (boleto)',            exemplo: '100',                  caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'bairro',      label: 'Bairro',                    exemplo: 'Centro',               caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'cidade',      label: 'Cidade',                    exemplo: 'São Paulo',            caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'uf',          label: 'UF',                        exemplo: 'SP',                   caminho: 'Acadêmico → Responsáveis → Financeiro' },
    { campo: 'cep',         label: 'CEP',                       exemplo: '01310-100',            caminho: 'Acadêmico → Responsáveis → Financeiro' },
  ]},
  { grupo: 'Turma / Série', fonte: 'turma', icone: '🏫', campos: [
    { campo: 'nome',         label: 'Nome da turma',            exemplo: '7º Ano A',             caminho: 'Pedagógico → Turmas' },
    { campo: 'codigo',       label: 'Código da turma',          exemplo: 'EF7A2026',             caminho: 'Pedagógico → Turmas' },
    { campo: 'serie',        label: 'Série/Ano',                exemplo: '7º Ano',               caminho: 'Pedagógico → Turmas' },
    { campo: 'segmento',     label: 'Segmento de ensino',       exemplo: 'Fundamental II',       caminho: 'Pedagógico → Turmas' },
    { campo: 'turno',        label: 'Turno',                    exemplo: 'Manhã',                caminho: 'Pedagógico → Turmas' },
    { campo: 'anoLetivo',    label: 'Ano letivo',               exemplo: '2026',                 caminho: 'Pedagógico → Turmas' },
    { campo: 'sala',         label: 'Sala física',              exemplo: 'Sala 12 — Bloco A',  caminho: 'Pedagógico → Turmas / Ensalamento' },
    { campo: 'professor',    label: 'Professor(a) regente',     exemplo: 'Prof. Maria José',     caminho: 'Pedagógico → Turmas' },
    { campo: 'capacidade',   label: 'Capacidade da turma',      exemplo: '35',                   caminho: 'Pedagógico → Turmas' },
    { campo: 'matriculados', label: 'Nº de alunos matriculados',exemplo: '32',                   caminho: 'Pedagógico → Turmas' },
    { campo: 'unidade',      label: 'Unidade da turma',         exemplo: 'Colégio Impacto',      caminho: 'Pedagógico → Turmas' },
  ]},
  { grupo: 'Dados Financeiros do Contrato', fonte: 'financeiro', icone: '💵', campos: [
    { campo: 'valorMensalidade', label: 'Valor da mensalidade',      exemplo: 'R$ 1.200,00',      caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'totalParcelas',    label: 'Quantidade de parcelas',    exemplo: '12',               caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'anuidade',         label: 'Valor da anuidade total',   exemplo: 'R$ 14.400,00',     caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'diaVencimento',    label: 'Dia de vencimento',         exemplo: '10',               caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'formaPagamento',   label: 'Forma de pagamento',        exemplo: 'Boleto Bancário',  caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'bolsista',         label: 'Bolsista?',                 exemplo: 'Não',              caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'pctDesconto',      label: 'Percentual de desconto',    exemplo: '10%',              caminho: 'Financeiro → Grupos de Desconto' },
    { campo: 'valorDesconto',    label: 'Valor do desconto R$',      exemplo: 'R$ 120,00',        caminho: 'Financeiro → Grupos de Desconto' },
    { campo: 'grupoDesconto',    label: 'Grupo de desconto',         exemplo: 'Desconto Irmãos',  caminho: 'Financeiro → Grupos de Desconto' },
    { campo: 'tipoMatricula',    label: 'Tipo de matrícula',         exemplo: 'Renovação',        caminho: 'Acadêmico → Alunos → Nova Matrícula' },
    { campo: 'dataIngresso',     label: 'Data de ingresso escolar',  exemplo: '01/02/2026',       caminho: 'Acadêmico → Alunos → Nova Matrícula' },
    { campo: 'dataContrato',     label: 'Data do contrato',          exemplo: '15/01/2026',       caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'numMatricula',     label: 'Nº do contrato/matrícula',  exemplo: '20260001',         caminho: 'Acadêmico → Alunos → Nova Matrícula' },
    { campo: 'anoLetivo',        label: 'Ano letivo do contrato',    exemplo: '2026',             caminho: 'Acadêmico → Alunos → Nova Matrícula' },
    { campo: 'planoPagamento',   label: 'Plano de pagamento',        exemplo: 'Mensal 12x',       caminho: 'Financeiro → Padrão de Pagamentos' },
    { campo: 'obsFinanceiro',    label: 'Observações financeiras',   exemplo: 'Paga via PIX',     caminho: 'Financeiro → Matrículas → Contrato' },
    { campo: 'eventoFinanceiro', label: 'Evento financeiro',         exemplo: 'Mensalidade 2026', caminho: 'Financeiro → Eventos Financeiros' },
  ]},
  { grupo: 'Parcelas (1ª gerada)', fonte: 'parcela', icone: '📅', campos: [
    { campo: 'num',         label: '# da parcela',             exemplo: '1',                  caminho: 'Financeiro → Contas a Receber' },
    { campo: 'competencia', label: 'Competência',              exemplo: 'janeiro de 2026',    caminho: 'Financeiro → Contas a Receber' },
    { campo: 'vencimento',  label: 'Data de vencimento',       exemplo: '10/01/2026',         caminho: 'Financeiro → Contas a Receber' },
    { campo: 'valor',       label: 'Valor bruto',              exemplo: 'R$ 1.200,00',        caminho: 'Financeiro → Contas a Receber' },
    { campo: 'desconto',    label: 'Desconto',                 exemplo: 'R$ 0,00',            caminho: 'Financeiro → Contas a Receber' },
    { campo: 'valorFinal',  label: 'Valor final (com desc.)',  exemplo: 'R$ 1.200,00',        caminho: 'Financeiro → Contas a Receber' },
    { campo: 'totalArray',  label: 'Total de parcelas',        exemplo: '12',                 caminho: 'Financeiro → Contas a Receber' },
  ]},
  { grupo: 'Escola — Dados Institucionais', fonte: 'escola', icone: '🏛️', campos: [
    { campo: 'unidade',          label: 'Nome da unidade (fantasia)',   exemplo: 'Colégio Impacto',                caminho: 'Configurações → Instituição' },
    { campo: 'razaoSocial',      label: 'Razão social',                 exemplo: 'Instituto Educacional Ltda',     caminho: 'Configurações → Instituição → Mantenedor' },
    { campo: 'cnpj',             label: 'CNPJ',                         exemplo: '00.000.000/0001-00',             caminho: 'Configurações → Instituição' },
    { campo: 'inep',             label: 'Código INEP',                  exemplo: '35000001',                       caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'codigoMec',        label: 'Código MEC',                   exemplo: '12345',                          caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'cidade',           label: 'Cidade da escola',             exemplo: 'São Paulo',                      caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'estado',           label: 'Estado (UF)',                  exemplo: 'SP',                             caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'endereco',         label: 'Endereço completo',            exemplo: 'Av. Paulista, 1000',             caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'bairro',           label: 'Bairro',                       exemplo: 'Bela Vista',                     caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'cep',              label: 'CEP',                          exemplo: '01310-100',                      caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'telefone',         label: 'Telefone da escola',           exemplo: '(11) 3200-0000',                 caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'email',            label: 'E-mail institucional',         exemplo: 'secretaria@impacto.edu.br',      caminho: 'Configurações → Instituição → Unidade' },
    { campo: 'diretor',          label: 'Nome do Diretor(a)',           exemplo: 'Prof. Dr. Carlos Mendes',        caminho: 'Configurações → Instituição → Diretor' },
    { campo: 'diretorCpf',       label: 'CPF do Diretor(a)',            exemplo: '111.222.333-44',                 caminho: 'Configurações → Instituição → Diretor' },
    { campo: 'diretorCargo',     label: 'Cargo do Diretor(a)',          exemplo: 'Diretor Geral',                  caminho: 'Configurações → Instituição → Diretor' },
    { campo: 'secretario',       label: 'Nome do Secretário(a)',        exemplo: 'Marta Oliveira',                 caminho: 'Configurações → Instituição → Secretaria' },
    { campo: 'secretarioCpf',    label: 'CPF do Secretário(a)',         exemplo: '555.666.777-88',                 caminho: 'Configurações → Instituição → Secretaria' },
    { campo: 'cabecalho',        label: 'Cabeçalho dos documentos',    exemplo: 'Colégio Impacto — CNPJ...',      caminho: 'Configurações → Instituição → Cabeçalho' },
    { campo: 'secretaria',       label: 'Secretaria (texto fixo)',      exemplo: 'Secretaria Escolar',             caminho: 'Configurações → Instituição' },
    { campo: 'website',          label: 'Site institucional',           exemplo: 'www.colegio-impacto.edu.br',     caminho: 'Configurações → Instituição → Mantenedor' },
  ]},
  { grupo: 'Data e Tempo', fonte: 'data', icone: '📆', campos: [
    { campo: 'data_hoje',    label: 'Data atual (dd/mm/aaaa)',             exemplo: new Date().toLocaleDateString('pt-BR'),                                              caminho: 'Sistema (automático)' },
    { campo: 'data_extenso', label: 'Data por extenso',                   exemplo: new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' } as any),             caminho: 'Sistema (automático)' },
    { campo: 'data_iso',     label: 'Data ISO (aaaa-mm-dd)',               exemplo: new Date().toISOString().slice(0,10),                                              caminho: 'Sistema (automático)' },
    { campo: 'mes_atual',    label: 'Mês atual (por extenso)',            exemplo: new Date().toLocaleDateString('pt-BR', { month: 'long' } as any),                 caminho: 'Sistema (automático)' },
    { campo: 'mes_num',      label: 'Mês atual (número)',                 exemplo: String(new Date().getMonth()+1).padStart(2,'0'),                                    caminho: 'Sistema (automático)' },
    { campo: 'ano_atual',    label: 'Ano atual (4 dígitos)',              exemplo: String(new Date().getFullYear()),                                                    caminho: 'Sistema (automático)' },
    { campo: 'dia_atual',    label: 'Dia do mês',                         exemplo: String(new Date().getDate()).padStart(2,'0'),                                        caminho: 'Sistema (automático)' },
    { campo: 'dia_semana',   label: 'Dia da semana',                      exemplo: new Date().toLocaleDateString('pt-BR', { weekday: 'long' } as any),               caminho: 'Sistema (automático)' },
    { campo: 'hora_atual',   label: 'Hora atual (HH:MM)',                 exemplo: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),      caminho: 'Sistema (automático)' },
    { campo: 'cidade_data',  label: 'Cidade, Data (para assinatura)',     exemplo: 'São Paulo, 31 de março de 2026',                                                   caminho: 'Sistema (automático)' },
  ]},
]

// Resolve um MapeamentoUsuario para um valor real
const resolverCampo = (map: MapeamentoUsuario, aluno: any, turma: any): string => {
  if (map.fonte === 'fixo') return map.valorFixo ?? ''
  if (map.fonte === 'data') {
    if (map.campo === 'data_hoje')    return new Date().toLocaleDateString('pt-BR')
    if (map.campo === 'data_extenso') return new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })
    if (map.campo === 'mes_atual')    return new Date().toLocaleDateString('pt-BR', { month: 'long' })
    if (map.campo === 'ano_atual')    return String(new Date().getFullYear())
    return ''
  }
  if (map.fonte === 'escola') {
    const ESCOLA: Record<string, string> = {
      unidade: 'Colégio Impacto', cidade: 'São Paulo', estado: 'SP',
      cnpj: '00.000.000/0001-00', diretor: 'Prof. Carlos Mendes', secretaria: 'Secretaria Escolar',
    }
    return ESCOLA[map.campo] ?? ''
  }
  if (map.fonte === 'aluno') {
    const val = aluno?.[map.campo]
    if (map.campo === 'dataNascimento' && val)
      return new Date(val + 'T12:00').toLocaleDateString('pt-BR')
    return val ?? ''
  }
  if (map.fonte === 'turma') return turma?.[map.campo] ?? ''
  // Fontes da matrícula — em preview usam dados de demonstração
  if (map.fonte === 'mae')      return aluno?._mae?.[map.campo]      ?? `(${map.campo} mãe)`
  if (map.fonte === 'pai')      return aluno?._pai?.[map.campo]      ?? `(${map.campo} pai)`
  if (map.fonte === 'resp_ped') return aluno?._respPed?.[map.campo]  ?? `(${map.campo} resp.ped.)`
  if (map.fonte === 'resp_fin') return aluno?._respFin?.[map.campo]  ?? `(${map.campo} resp.fin.)`
  if (map.fonte === 'financeiro') return aluno?._financeiro?.[map.campo] ?? `(${map.campo} fin.)`
  if (map.fonte === 'parcela')  return aluno?._parcelas?.[0]?.[map.campo] != null
    ? String(aluno._parcelas[0][map.campo]) : `(parcela.${map.campo})`
  return ''
}

// ─── Interfaces de documento e histórico ──────────────────────────────────────
interface DocumentoModelo {
  id: string
  nome: string
  tipo: string
  segmento: string
  unidade: string
  versao: number
  status: 'ativo' | 'inativo'
  templateTexto: string
  mascarasDetectadas: string[]
  mascarasInvalidas: string[]
  criadoEm: string
  atualizadoEm: string
  descricao?: string
  // Suporte a DOCX
  arquivoBase64?: string    // conteúdo binário do .docx em base64
  arquivoNome?: string      // nome original do arquivo carregado
}

interface HistoricoGeracao {
  id: string
  documentoId: string
  documentoNome: string
  alunoId: string
  alunoNome: string
  geradoEm: string
  usuario: string
  status: 'sucesso' | 'erro'
  conteudoGerado?: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const TIPOS_DOC = [
  'Declaração de Matrícula', 'Histórico Escolar', 'Declaração de Frequência',
  'Atestado de Série', 'Transferência', 'Nada Consta Financeiro',
  'Contrato por Segmento', 'Aditamento por Segmento', 'Aditamento Esportes',
  'Contrato Atividades Extras', 'Contrato Progressão Parcial',
  'Declaração Entrega de Documento', 'Declaração Transferência DP',
  'Advertência', 'Suspensão', 'Termo de Compromisso',
  'Requerimento de Transferência', 'Requerimento de Itinerário',
  'Requerimento por Segmento', 'Requerimento 2ª Chamada',
  'Requerimento de Cancelamento de Matrícula', 'Personalizado',
]

const SEGMENTOS = ['Todos', 'Educação Infantil', 'Fundamental I', 'Fundamental II', 'Ensino Médio', 'EJA']

// Mapeamento interno: código → campo do sistema
const MAPA_INTERNO: Record<string, (aluno: any, turma: any) => string> = {
  '<<aluno>>':              (a) => a?.nome ?? '(Nome do aluno)',
  '<<nome_completo>>':      (a) => a?.nome ?? '(Nome do aluno)',
  '<<cpf_aluno>>':          (a) => a?.cpf ?? '(CPF)',
  '<<rg_aluno>>':           (a) => a?.rg ?? '(RG)',
  '<<data_nascimento>>':    (a) => a?.dataNascimento ? new Date(a.dataNascimento+'T12:00').toLocaleDateString('pt-BR') : '(Data nasc.)',
  '<<responsavel>>':        (a) => a?.responsavel ?? a?.nomeResponsavel ?? '(Responsável)',
  '<<turma>>':              (_, t) => t?.nome ?? '(Turma)',
  '<<serie>>':              (_, t) => t?.serie ?? t?.nome ?? '(Série)',
  '<<segmento>>':           (_, t) => t?.segmento ?? '(Segmento)',
  '<<turno>>':              (_, t) => t?.turno ?? '(Turno)',
  '<<ano_letivo>>':         (_, t) => t?.anoLetivo ?? String(new Date().getFullYear()),
  '<<data_hoje>>':          () => new Date().toLocaleDateString('pt-BR'),
  '<<unidade>>':            () => 'Colégio Impacto',
  '<<cidade>>':             () => '(Cidade)',
  '<<matricula>>':          (a) => a?.matricula ?? a?.id ?? '(Matrícula)',
  '<<email_aluno>>':        (a) => a?.email ?? '(E-mail)',
  '<<telefone_resp>>':      (a) => a?.telefoneResponsavel ?? a?.telefone ?? '(Telefone)',
  '<<endereco>>':           (a) => a?.endereco ?? '(Endereço)',
}

// Dicionário padrão de máscaras
const MASCARAS_PADRAO: Mascara[] = [
  { codigo: '<<aluno>>',           descricao: 'Nome completo do aluno',        categoria: 'aluno',    ativo: true },
  { codigo: '<<nome_completo>>',   descricao: 'Nome completo do aluno',        categoria: 'aluno',    ativo: true },
  { codigo: '<<cpf_aluno>>',       descricao: 'CPF do aluno',                  categoria: 'aluno',    ativo: true },
  { codigo: '<<rg_aluno>>',        descricao: 'RG do aluno',                   categoria: 'aluno',    ativo: true },
  { codigo: '<<data_nascimento>>', descricao: 'Data de nascimento do aluno',   categoria: 'aluno',    ativo: true },
  { codigo: '<<matricula>>',       descricao: 'Número de matrícula',           categoria: 'aluno',    ativo: true },
  { codigo: '<<responsavel>>',     descricao: 'Nome do responsável',           categoria: 'aluno',    ativo: true },
  { codigo: '<<telefone_resp>>',   descricao: 'Telefone do responsável',       categoria: 'aluno',    ativo: true },
  { codigo: '<<email_aluno>>',     descricao: 'E-mail do aluno',               categoria: 'aluno',    ativo: true },
  { codigo: '<<endereco>>',        descricao: 'Endereço do aluno',             categoria: 'aluno',    ativo: true },
  { codigo: '<<turma>>',           descricao: 'Turma do aluno',                categoria: 'escola',   ativo: true },
  { codigo: '<<serie>>',           descricao: 'Série',                         categoria: 'escola',   ativo: true },
  { codigo: '<<segmento>>',        descricao: 'Segmento de ensino',            categoria: 'escola',   ativo: true },
  { codigo: '<<turno>>',           descricao: 'Turno (Manhã/Tarde/Noite)',     categoria: 'escola',   ativo: true },
  { codigo: '<<ano_letivo>>',      descricao: 'Ano letivo atual',              categoria: 'escola',   ativo: true },
  { codigo: '<<unidade>>',         descricao: 'Nome da unidade escolar',       categoria: 'escola',   ativo: true },
  { codigo: '<<cidade>>',          descricao: 'Cidade da unidade',             categoria: 'escola',   ativo: true },
  { codigo: '<<data_hoje>>',       descricao: 'Data atual por extenso',        categoria: 'data',     ativo: true },
]

const TEMPLATE_DECLARACAO = `DECLARAÇÃO DE MATRÍCULA

Declaramos para os devidos fins que o(a) aluno(a) <<aluno>>, portador(a) do CPF <<cpf_aluno>>, encontra-se devidamente matriculado(a) nesta instituição, na turma <<turma>>, segmento <<segmento>>, turno <<turno>>, no ano letivo de <<ano_letivo>>.

Por ser verdade, firmamos a presente declaração.

<<cidade>>, <<data_hoje>>.

__________________________________
Secretaria Escolar — <<unidade>>`

function detectarMascaras(texto: string): string[] {
  const matches = texto.match(/<<[a-z_]+>>/g) ?? []
  return [...new Set(matches)]
}

// Substituição: usa mapeamentos do usuário primeiro; fallback MAPA_INTERNO
function substituir(
  texto: string, aluno: any, turma: any,
  mapeamentosUsuario: MapeamentoUsuario[] = []
): string {
  let result = texto
  // 1. Aplica mapeamentos definidos pelo usuário
  for (const map of mapeamentosUsuario) {
    const valor = resolverCampo(map, aluno, turma)
    if (valor) result = result.split(map.codigoMascara).join(valor)
  }
  // 2. Fallback: MAPA_INTERNO para o que ainda não foi substituído
  for (const [cod, fn] of Object.entries(MAPA_INTERNO)) {
    result = result.split(cod).join(fn(aluno, turma))
  }
  return result
}

// ─── Modal de Mapeamento ───────────────────────────────────────────────────────
function ModalMapear({ mascaras, mapeamentos, onClose, onSave, alunoDemo }: {
  mascaras: Mascara[]
  mapeamentos: MapeamentoUsuario[]
  onClose: () => void
  onSave: (maps: MapeamentoUsuario[]) => void
  alunoDemo?: any
}) {
  const [maps, setMaps] = useState<(MapeamentoUsuario & { campo: string })[]>(() => {
    const result: (MapeamentoUsuario & { campo: string })[] = []
    mascaras.forEach(m => {
      const existing = mapeamentos.find(x => x.codigoMascara === m.codigo)
      if (existing) { result.push(existing as any); return }
      if (MAPA_INTERNO[m.codigo]) {
        result.push({ codigoMascara: m.codigo, fonte: 'aluno' as const, campo: '__interno__' })
      } else {
        result.push({ codigoMascara: m.codigo, fonte: 'aluno' as const, campo: '' })
      }
    })
    return result
  })
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  // Novo: busca de campo DENTRO do painel expandido
  const [buscaCampo, setBuscaCampo] = useState<Record<string, string>>({})

  const setMap = (codigo: string, partial: Partial<MapeamentoUsuario & { campo: string }>) =>
    setMaps(prev => prev.map(m => m.codigoMascara === codigo ? { ...m, ...partial } as any : m))

  const autoMapear = () => {
    setMaps(prev => prev.map(m => {
      if (m.campo && m.campo !== '__interno__') return m
      const cod = m.codigoMascara.replace(/<<|>>/g, '')
      const matchers: [string, MapeamentoUsuario][] = [
        // Aluno
        ['nome|aluno|nome_completo',   { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'nome' }],
        ['cpf_aluno|cpf',              { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'cpf' }],
        ['rg_aluno|rg',                { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'rg' }],
        ['nasc|nascimento|data_nasc',  { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'dataNascimento' }],
        ['matricula|matric',           { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'matricula' }],
        ['rga',                        { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'rga' }],
        ['id_censo|censo',             { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'idCenso' }],
        ['sexo',                       { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'sexo' }],
        ['raca|cor|etnia',             { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'racaCor' }],
        ['naturalidade',               { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'naturalidade' }],
        ['email_aluno|email',          { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'email' }],
        ['celular|telefone_aluno',     { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'celular' }],
        ['endereco|endere',            { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'endereco' }],
        ['filiacao_mae',               { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'filiacaoMae' }],
        ['filiacao_pai',               { codigoMascara: m.codigoMascara, fonte: 'aluno',     campo: 'filiacaoPai' }],
        // Mãe
        ['nome_mae',                   { codigoMascara: m.codigoMascara, fonte: 'mae',       campo: 'nome' }],
        ['cpf_mae',                    { codigoMascara: m.codigoMascara, fonte: 'mae',       campo: 'cpf' }],
        ['rg_mae',                     { codigoMascara: m.codigoMascara, fonte: 'mae',       campo: 'rg' }],
        ['celular_mae|fone_mae',       { codigoMascara: m.codigoMascara, fonte: 'mae',       campo: 'celular' }],
        ['email_mae',                  { codigoMascara: m.codigoMascara, fonte: 'mae',       campo: 'email' }],
        ['profissao_mae',              { codigoMascara: m.codigoMascara, fonte: 'mae',       campo: 'profissao' }],
        // Pai
        ['nome_pai',                   { codigoMascara: m.codigoMascara, fonte: 'pai',       campo: 'nome' }],
        ['cpf_pai',                    { codigoMascara: m.codigoMascara, fonte: 'pai',       campo: 'cpf' }],
        ['rg_pai',                     { codigoMascara: m.codigoMascara, fonte: 'pai',       campo: 'rg' }],
        ['celular_pai|fone_pai',       { codigoMascara: m.codigoMascara, fonte: 'pai',       campo: 'celular' }],
        ['email_pai',                  { codigoMascara: m.codigoMascara, fonte: 'pai',       campo: 'email' }],
        ['profissao_pai',              { codigoMascara: m.codigoMascara, fonte: 'pai',       campo: 'profissao' }],
        // Resp. Pedagógico
        ['resp_ped|resp_pedagogico|responsavel_pedagogico', { codigoMascara: m.codigoMascara, fonte: 'resp_ped', campo: 'nome' }],
        ['cpf_resp_ped',               { codigoMascara: m.codigoMascara, fonte: 'resp_ped',  campo: 'cpf' }],
        ['fone_resp_ped|tel_resp_ped', { codigoMascara: m.codigoMascara, fonte: 'resp_ped',  campo: 'celular' }],
        // Resp. Financeiro
        ['resp_fin|resp_financeiro|responsavel_financeiro', { codigoMascara: m.codigoMascara, fonte: 'resp_fin', campo: 'nome' }],
        ['cpf_resp_fin',               { codigoMascara: m.codigoMascara, fonte: 'resp_fin',  campo: 'cpf' }],
        ['fone_resp_fin|tel_resp_fin', { codigoMascara: m.codigoMascara, fonte: 'resp_fin',  campo: 'celular' }],
        // Turma
        ['turma',                      { codigoMascara: m.codigoMascara, fonte: 'turma',     campo: 'nome' }],
        ['serie|série',               { codigoMascara: m.codigoMascara, fonte: 'turma',     campo: 'serie' }],
        ['segmento',                   { codigoMascara: m.codigoMascara, fonte: 'turma',     campo: 'segmento' }],
        ['turno',                      { codigoMascara: m.codigoMascara, fonte: 'turma',     campo: 'turno' }],
        ['ano_letivo',                 { codigoMascara: m.codigoMascara, fonte: 'turma',     campo: 'anoLetivo' }],
        // Financeiro
        ['mensalidade|valor_mens',     { codigoMascara: m.codigoMascara, fonte: 'financeiro', campo: 'valorMensalidade' }],
        ['parcelas|total_parcelas',    { codigoMascara: m.codigoMascara, fonte: 'financeiro', campo: 'totalParcelas' }],
        ['forma_pagamento|pagamento',  { codigoMascara: m.codigoMascara, fonte: 'financeiro', campo: 'formaPagamento' }],
        ['vencimento|dia_venc',        { codigoMascara: m.codigoMascara, fonte: 'financeiro', campo: 'diaVencimento' }],
        ['anuidade',                   { codigoMascara: m.codigoMascara, fonte: 'financeiro', campo: 'anuidade' }],
        // Data
        ['data_hoje|hoje',             { codigoMascara: m.codigoMascara, fonte: 'data',      campo: 'data_hoje' }],
        ['data_extenso',               { codigoMascara: m.codigoMascara, fonte: 'data',      campo: 'data_extenso' }],
        ['mes_atual|mes',              { codigoMascara: m.codigoMascara, fonte: 'data',      campo: 'mes_atual' }],
        ['ano_atual|ano',              { codigoMascara: m.codigoMascara, fonte: 'data',      campo: 'ano_atual' }],
        // Escola
        ['unidade',                    { codigoMascara: m.codigoMascara, fonte: 'escola',    campo: 'unidade' }],
        ['cidade',                     { codigoMascara: m.codigoMascara, fonte: 'escola',    campo: 'cidade' }],
        ['diretor',                    { codigoMascara: m.codigoMascara, fonte: 'escola',    campo: 'diretor' }],
        ['cnpj',                       { codigoMascara: m.codigoMascara, fonte: 'escola',    campo: 'cnpj' }],
      ]
      for (const [pattern, mapping] of matchers) {
        if (pattern.split('|').some(p => cod.includes(p))) return mapping
      }
      return m
    }))
  }

  const mascFiltered = useMemo(() => {
    // Deduplica por codigo para evitar erro de key duplicada no React
    const seen = new Set<string>()
    const unicas = mascaras.filter(m => {
      if (seen.has(m.codigo)) return false
      seen.add(m.codigo)
      return true
    })
    if (!busca) return unicas
    const q = busca.toLowerCase()
    return unicas.filter(m => m.codigo.includes(q) || m.descricao?.toLowerCase().includes(q))
  }, [mascaras, busca])

  const getPreview = (codigo: string): string => {
    const map = maps.find(m => m.codigoMascara === codigo)
    if (!map || !map.campo) return ''
    if (map.campo === '__interno__') {
      const fn = MAPA_INTERNO[codigo]
      return fn ? fn(alunoDemo, {}) + ' (padrão)' : ''
    }
    if (map.fonte === 'fixo') return map.valorFixo ? `"${map.valorFixo}"` : ''
    const campo = CAMPOS_DISPONIVEIS.flatMap(g => g.campos).find(c => c.campo === map.campo)
    return campo?.exemplo ?? ''
  }

  const totalMapeadas = maps.filter(m => m.campo && m.campo !== '' && m.campo !== '__interno__').length
  const totalInternas = maps.filter(m => m.campo === '__interno__').length
  const totalVazias = maps.filter(m => !m.campo).length

  const COR_FONTE: Record<string, string> = {
    aluno:      '#3b82f6',
    mae:        '#ec4899',
    pai:        '#06b6d4',
    resp_ped:   '#8b5cf6',
    resp_fin:   '#10b981',
    turma:      '#34d399',
    financeiro: '#f59e0b',
    parcela:    '#fb923c',
    escola:     '#a78bfa',
    data:       '#64748b',
    fixo:       '#6b7280',
  }
  const LABEL_FONTE: Record<string, string> = {
    aluno:      '👤 Aluno',
    mae:        '👩 Mãe',
    pai:        '👨 Pai',
    resp_ped:   '📚 Resp. Pedagógico',
    resp_fin:   '💰 Resp. Financeiro',
    turma:      '🏫 Turma/Série',
    financeiro: '💵 Dados Financeiros',
    parcela:    '📅 Parcela',
    escola:     '🏛️ Escola',
    data:       '📆 Data/Tempo',
    fixo:       '✏️ Valor Fixo',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 4000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 900, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.8)', marginBottom: 24 }}>

        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(16,185,129,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Link2 size={22} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Mapeamento de Máscaras</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Vincule cada máscara a um campo real do sistema para substituição automática
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        {/* Resumo + controles */}
        <div style={{ padding: '14px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>✓ {totalMapeadas + totalInternas} mapeadas</span>
            {totalVazias > 0 && <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700 }}>⚠ {totalVazias} sem mapeamento</span>}
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 700 }}>🔒 {totalInternas} padrão</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={autoMapear}>
              <Wand2 size={13} />Auto-mapear
            </button>
          </div>
          <div style={{ position: 'relative', minWidth: 220 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft: 28, fontSize: 12 }} placeholder="Filtrar máscaras..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>

        {/* Info sobre campos internos */}
        <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
          <span style={{ fontWeight: 700, color: '#818cf8' }}>🔒 Padrão do sistema</span> — máscaras marcadas com "Padrão" usam mapeamento interno automático e não precisam de configuração. Você pode substituí-las por um mapeamento personalizado se necessário.
        </div>

        {/* Lista de máscaras para mapear */}
        <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: '12px 28px 8px' }}>
          {mascFiltered.map(m => {
            const map = maps.find(x => x.codigoMascara === m.codigo) ?? { codigoMascara: m.codigo, fonte: 'aluno' as const, campo: '' }
            const ehInterno = map.campo === '__interno__'
            const ehMapeado = map.campo && !ehInterno
            const preview = getPreview(m.codigo)
            const corFonte = COR_FONTE[map.fonte] ?? '#6b7280'
            const aberto = expandido === m.codigo

            return (
              <div key={m.codigo} style={{ marginBottom: 8, border: `1px solid ${ehInterno ? 'rgba(99,102,241,0.2)' : ehMapeado ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 12, overflow: 'hidden', background: ehInterno ? 'rgba(99,102,241,0.03)' : ehMapeado ? 'rgba(16,185,129,0.03)' : 'rgba(245,158,11,0.03)' }}>
                {/* Linha de resumo — clicável para expandir */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  onClick={() => setExpandido(aberto ? null : m.codigo)}>
                  <code style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 6, minWidth: 140 }}>{m.codigo}</code>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descricao}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {ehInterno && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 700 }}>🔒 Padrão</span>
                    )}
                    {ehMapeado && !ehInterno && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${corFonte}20`, color: corFonte, fontWeight: 700 }}>
                        {LABEL_FONTE[map.fonte] ?? map.fonte} → {map.campo}
                      </span>
                    )}
                    {!ehInterno && !ehMapeado && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 700 }}>⚠ Sem mapeamento</span>
                    )}
                    {preview && <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontStyle: 'italic', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ex: {preview}</span>}
                    <ChevronDown size={13} style={{ color: 'hsl(var(--text-muted))', transform: aberto ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                  </div>
                </div>

                {/* Painel expandido de configuração */}
                {aberto && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Fonte */}
                    <div>
                      <label className="form-label">Fonte dos dados</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(Object.keys(LABEL_FONTE) as Array<keyof typeof LABEL_FONTE>).map(f => (
                          <button key={f} type="button"
                            onClick={() => setMap(m.codigo, { fonte: f as any, campo: '' })}
                            style={{ padding: '5px 12px', borderRadius: 8, border: `2px solid ${map.fonte === f ? COR_FONTE[f] : 'hsl(var(--border-subtle))'}`, background: map.fonte === f ? `${COR_FONTE[f]}18` : 'transparent', fontWeight: 700, fontSize: 11, cursor: 'pointer', color: map.fonte === f ? COR_FONTE[f] : 'hsl(var(--text-muted))', transition: 'all 0.15s' }}>
                            {LABEL_FONTE[f]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Campo — valor fixo */}
                    {map.fonte === 'fixo' ? (
                      <div>
                        <label className="form-label">Valor fixo</label>
                        <input className="form-input" value={map.valorFixo ?? ''}
                          onChange={e => setMap(m.codigo, { campo: 'fixo', valorFixo: e.target.value })}
                          placeholder="Digite o valor que será substituído sempre..." />
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Este valor será inserido igual para todos os documentos.</div>
                      </div>
                    ) : (
                      <div>
                        <label className="form-label">🔍 Buscar campo do sistema</label>
                        {/* Busca unificada que filtra em TODOS os grupos/campanhos */}
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                          <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))', pointerEvents:'none' }} />
                          <input className="form-input" style={{ paddingLeft:28, fontSize:12 }}
                            placeholder={`Buscar em ${LABEL_FONTE[map.fonte] ?? map.fonte}... (ex: CPF, endereço, nome)`}
                            value={buscaCampo[m.codigo] ?? ''}
                            onChange={e => setBuscaCampo(prev => ({ ...prev, [m.codigo]: e.target.value }))}
                          />
                          {buscaCampo[m.codigo] && (
                            <button type="button" onClick={() => setBuscaCampo(prev => ({ ...prev, [m.codigo]: '' }))}
                              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'hsl(var(--text-muted))' }}>
                              <X size={11} />
                            </button>
                          )}
                        </div>

                        {/* Lista filtrada de campos */}
                        {(() => {
                          const q = (buscaCampo[m.codigo] ?? '').toLowerCase()
                          // Agrupa os campos da fonte selecionada (ou todos se buscando)
                          const gruposParaExibir = CAMPOS_DISPONIVEIS.filter(g =>
                            q ? true : g.fonte === map.fonte
                          )
                          const todosOsCampos = gruposParaExibir.flatMap(g =>
                            g.campos
                              .filter(c => !q ||
                                c.label.toLowerCase().includes(q) ||
                                c.campo.toLowerCase().includes(q) ||
                                c.exemplo.toLowerCase().includes(q) ||
                                (c.caminho ?? '').toLowerCase().includes(q)
                              )
                              .map(c => ({ ...c, grupo: g.grupo, fonte: g.fonte, icone: g.icone ?? '📄' }))
                          )

                          if (todosOsCampos.length === 0 && q) return (
                            <div style={{ fontSize:12, color:'hsl(var(--text-muted))', padding:'8px 10px', textAlign:'center', border:'1px solid hsl(var(--border-subtle))', borderRadius:8 }}>
                              Nenhum campo encontrado para "{buscaCampo[m.codigo]}"
                            </div>
                          )

                          // Quando tem busca cross-fonte, agrupa por grupo
                          const porGrupo: Record<string, typeof todosOsCampos> = {}
                          todosOsCampos.forEach(c => {
                            const k = `${c.icone} ${c.grupo}`
                            if (!porGrupo[k]) porGrupo[k] = []
                            porGrupo[k].push(c)
                          })

                          return (
                            <div style={{ maxHeight:260, overflowY:'auto', border:'1px solid hsl(var(--border-subtle))', borderRadius:10 }}>
                              {Object.entries(porGrupo).map(([grpLabel, clist]) => (
                                <div key={grpLabel}>
                                  <div style={{ padding:'5px 12px', fontSize:10, fontWeight:800, color:'hsl(var(--text-muted))', background:'hsl(var(--bg-overlay))', borderBottom:'1px solid hsl(var(--border-subtle))', textTransform:'uppercase', letterSpacing:'0.08em', display:'flex', alignItems:'center', gap:6 }}>
                                    {grpLabel}
                                    {q && clist[0]?.fonte !== map.fonte && (
                                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:20, background:COR_FONTE[clist[0].fonte]+'20', color:COR_FONTE[clist[0].fonte], fontWeight:700 }}>fonte: {LABEL_FONTE[clist[0].fonte]}</span>
                                    )}
                                  </div>
                                  {clist.map(c => {
                                    const isSelected = map.campo === c.campo && map.fonte === c.fonte
                                    return (
                                      <button key={`${c.grupo}-${c.campo}`} type="button"
                                        onClick={() => {
                                          setMap(m.codigo, { campo: c.campo, fonte: c.fonte as any })
                                          setBuscaCampo(prev => ({ ...prev, [m.codigo]: c.label }))
                                        }}
                                        style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 12px', width:'100%', textAlign:'left', background: isSelected ? `${COR_FONTE[map.fonte]}12` : 'transparent', border:'none', borderBottom:'1px solid hsl(var(--border-subtle))', cursor:'pointer', transition:'background 0.1s' }}
                                        onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'hsl(var(--bg-hover))')}
                                        onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ fontSize:12, fontWeight:isSelected?800:600, color: isSelected ? COR_FONTE[map.fonte] : 'hsl(var(--text-primary))' }}>
                                            {isSelected && '✓ '}{c.label}
                                          </div>
                                          <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:2 }}>
                                            <code style={{ background:'hsl(var(--bg-overlay))', padding:'0 4px', borderRadius:4, fontSize:9 }}>{c.campo}</code>
                                            {' '}&rarr; ex: <em>{c.exemplo}</em>
                                          </div>
                                        </div>
                                        {c.caminho && (
                                          <div style={{ fontSize:9, color:'hsl(var(--text-disabled))', textAlign:'right', minWidth:120, lineHeight:1.4, marginTop:2 }}>
                                            📍 {c.caminho}
                                          </div>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                          )
                        })()}

                        {/* Campo selecionado atual */}
                        {map.campo && map.campo !== '__interno__' && map.campo !== '' && (() => {
                          const cDef = CAMPOS_DISPONIVEIS.flatMap(g => g.campos.map(c => ({ ...c, fonte: g.fonte, icone: g.icone }))).find(c => c.campo === map.campo && c.fonte === map.fonte)
                          return cDef ? (
                            <div style={{ marginTop:6, padding:'8px 12px', background:`${COR_FONTE[map.fonte]}08`, border:`1px solid ${COR_FONTE[map.fonte]}30`, borderRadius:8, display:'flex', alignItems:'center', gap:8 }}>
                              <Check size={13} color={COR_FONTE[map.fonte]} />
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:11, fontWeight:700, color: COR_FONTE[map.fonte] }}>{cDef.icone} {cDef.label}</div>
                                <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>Caminho: {cDef.caminho ?? '—'}</div>
                              </div>
                              <div style={{ fontSize:10, color:'hsl(var(--text-muted))', fontStyle:'italic' }}>ex: {cDef.exemplo}</div>
                            </div>
                          ) : null
                        })()}
                      </div>
                    )}

                    {/* Preview resultado */}
                    {getPreview(m.codigo) && (
                      <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: '#10b981' }}>Preview: </span>
                        <span style={{ fontFamily: 'monospace' }}>{m.codigo}</span>
                        <span style={{ color: 'hsl(var(--text-muted))' }}> → </span>
                        <strong>{getPreview(m.codigo).replace(' (padrão)', '')}</strong>
                        {ehInterno && <span style={{ color: '#818cf8', fontSize: 10, marginLeft: 6 }}>(mapeamento padrão)</span>}
                      </div>
                    )}

                    {/* Botão para usar padrão interno */}
                    {MAPA_INTERNO[m.codigo] && !ehInterno && (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', fontSize: 11, color: '#818cf8' }}
                        onClick={() => setMap(m.codigo, { campo: '__interno__', fonte: 'aluno' })}>
                        🔒 Usar mapeamento padrão do sistema
                      </button>
                    )}
                    {ehInterno && (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', fontSize: 11, color: '#f59e0b' }}
                        onClick={() => setMap(m.codigo, { campo: '', fonte: 'aluno' })}>
                        ✏ Definir mapeamento personalizado
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-elevated))' }}>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{mascaras.length} máscaras · {totalMapeadas + totalInternas} mapeadas · {totalVazias} sem vínculo</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => {
              // Salva somente os mapeamentos personalizados (não os __interno__)
              onSave(maps.filter(m => m.campo && m.campo !== '__interno__'))
            }}>
              <Check size={14} />Salvar Mapeamentos
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


// Converte mapeamentos + MAPA_INTERNO para objeto plano { campo: valor }
function resolverParaDocx(aluno: any, turma: any, userMaps: MapeamentoUsuario[]): Record<string, string> {
  const data: Record<string, string> = {}
  // 1. Mapeamentos do usuário
  for (const map of userMaps) {
    const key = map.codigoMascara.replace(/<<|>>/g, '')
    data[key] = resolverCampo(map, aluno, turma)
  }
  // 2. Fallback MAPA_INTERNO
  for (const [cod, fn] of Object.entries(MAPA_INTERNO)) {
    const key = cod.replace(/<<|>>/g, '')
    if (!data[key]) data[key] = fn(aluno, turma)
  }
  return data
}

// ─── Modal de cadastro/edição de documento ─────────────────────────────────
function ModalDocumento({ doc, onClose, onSave, mascaras }: {
  doc?: DocumentoModelo | null
  onClose: () => void
  onSave: (d: Omit<DocumentoModelo, 'id' | 'criadoEm' | 'atualizadoEm'>) => void
  mascaras: Mascara[]
}) {
  const [nome, setNome] = useState(doc?.nome ?? '')
  const [tipo, setTipo] = useState(doc?.tipo ?? TIPOS_DOC[0])
  const [tipoCustom, setTipoCustom] = useState('')
  const [segmento, setSegmento] = useState(doc?.segmento ?? 'Todos')
  const [unidade, setUnidade] = useState(doc?.unidade ?? '')
  const [status, setStatus] = useState<'ativo' | 'inativo'>(doc?.status ?? 'ativo')
  const [descricao, setDescricao] = useState(doc?.descricao ?? '')

  // Modo DOCX
  const [arquivoBase64, setArquivoBase64] = useState<string | undefined>(doc?.arquivoBase64)
  const [arquivoNome, setArquivoNome] = useState<string | undefined>(doc?.arquivoNome)
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [templateTexto, setTemplateTexto] = useState(doc?.templateTexto ?? '')
  const [modoDocx, setModoDocx] = useState(!!doc?.arquivoBase64)
  const fileRef = useRef<HTMLInputElement>(null)

  const codigosValidos = mascaras.filter(m => m.ativo).map(m => m.codigo)

  // Detecta máscaras no preview HTML (se docx) ou no texto
  const textoParaDetectar = modoDocx ? previewHtml.replace(/<[^>]+>/g, ' ') : templateTexto
  const detectadas = useMemo(() => detectarMascaras(textoParaDetectar), [textoParaDetectar])
  const invalidas = detectadas.filter(c => !codigosValidos.includes(c))
  const validas = detectadas.filter(c => codigosValidos.includes(c))

  // Destaca máscaras no HTML gerado pelo mammoth
  const previewDestacado = useMemo(() => {
    if (!previewHtml) return ''
    return previewHtml.replace(/<<([a-z_]+)>>/g, (match) => {
      const ok = codigosValidos.includes(match)
      return `<mark style="background:${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'};border-radius:3px;padding:0 2px;font-weight:700;color:${ok ? '#065f46' : '#9b1c1c'};font-family:monospace;font-size:0.85em">${match}</mark>`
    })
  }, [previewHtml, codigosValidos])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const isDocx = ext === 'docx'
    const isDoc  = ext === 'doc'
    const isTxt  = ext === 'txt'
    setArquivoNome(f.name)
    setPreviewLoading(true)

    try {
      const arrayBuffer = await f.arrayBuffer()

      // Salva como base64 para geração posterior
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      uint8.forEach(b => { binary += String.fromCharCode(b) })
      const b64 = btoa(binary)
      setArquivoBase64(b64)

      if (isDocx) {
        // .docx = formato moderno XML — mammoth suporta preview completo
        setModoDocx(true)
        try {
          const mammoth = (await import('mammoth')).default
          const result = await mammoth.convertToHtml({ arrayBuffer })
          setPreviewHtml(result.value)
          const texto = result.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          setTemplateTexto(texto.substring(0, 20000))
          if (result.messages?.length > 0) {
            console.warn('Avisos do mammoth:', result.messages)
          }
        } catch (mammothErr) {
          // Arquivo .docx corrompido ou não-padrão
          setPreviewHtml('')
          setTemplateTexto('')
          alert('⚠ Não foi possível renderizar o preview deste .docx. O arquivo foi salvo e a substituição de máscaras ainda funcionará normalmente ao gerar.')
          console.warn('mammoth error:', mammothErr)
        }
      } else if (isDoc) {
        // .doc = formato binário antigo (Word 97-2003) — mammoth NÃO suporta
        setModoDocx(true)
        setPreviewHtml('')
        setTemplateTexto('')
        alert('ℹ Arquivo .doc detectado.\n\nO formato .doc (Word 97-2003) não permite preview no navegador.\n\nO arquivo foi salvo. Para preview e substituição mais precisa, converta para .docx no Word (Arquivo → Salvar Como → .docx) e faça upload novamente.\n\nA geração do documento funcionará normalmente.')
      } else if (isTxt) {
        // Texto simples
        setModoDocx(false)
        const text = new TextDecoder().decode(uint8)
        setTemplateTexto(text.substring(0, 20000))
      } else {
        alert('Formato não suportado. Use .docx (recomendado), .doc ou .txt.')
        setArquivoBase64(undefined)
        setArquivoNome(undefined)
      }
    } catch (err) {
      alert('Erro ao processar o arquivo. Verifique se é um .docx válido.')
      console.error(err)
    } finally {
      setPreviewLoading(false)
      e.target.value = ''
    }
  }

  const tipoFinal = tipo === 'Personalizado' ? tipoCustom : tipo

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 920, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.7)', marginBottom: 24 }}>
        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(59,130,246,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{doc ? 'Editar Modelo' : 'Novo Modelo de Documento'}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Envie um .docx com máscaras &lt;&lt;assim&gt;&gt; — o sistema substitui automaticamente</div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Metadados */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <div>
              <label className="form-label">Nome do Documento *</label>
              <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Declaração de Código 2026" style={{ fontWeight: 600 }} />
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={status} onChange={e => setStatus(e.target.value as 'ativo' | 'inativo')}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>

          {tipo === 'Personalizado' && (
            <div><label className="form-label">Nome do tipo personalizado</label>
              <input className="form-input" value={tipoCustom} onChange={e => setTipoCustom(e.target.value)} placeholder="Ex: Autorização de Saída" /></div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14 }}>
            <div>
              <label className="form-label">Segmento</label>
              <select className="form-input" value={segmento} onChange={e => setSegmento(e.target.value)}>
                {SEGMENTOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Unidade (opcional)</label>
              <input className="form-input" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Todas as unidades" />
            </div>
            <div>
              <label className="form-label">Descrição / Observações</label>
              <input className="form-input" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Observação interna sobre este modelo..." />
            </div>
          </div>

          {/* Upload DOCX */}
          <div style={{ padding: '16px 20px', background: 'rgba(99,102,241,0.04)', border: '2px dashed rgba(99,102,241,0.3)', borderRadius: 12 }}>
            <label className="form-label" style={{ color: '#818cf8' }}>📄 Modelo Word</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', background: 'linear-gradient(135deg,#6366f1,#3b82f6)' }}>
                <Upload size={13} />{arquivoNome ? 'Substituir arquivo' : 'Carregar .docx'}
                <input ref={fileRef} type="file" accept=".docx,.doc,.txt" style={{ display: 'none' }} onChange={handleUpload} />
              </label>
              {arquivoNome && (
                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>✓ {arquivoNome}</span>
              )}
              {previewLoading && <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Processando arquivo...</span>}
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                Use máscaras <code style={{ background:'rgba(99,102,241,0.1)', padding:'1px 5px', borderRadius:4 }}>&lt;&lt;codigo&gt;&gt;</code> no texto do Word.<br />
                <span style={{ color: '#10b981' }}>✓ .docx</span> — preview completo com imagens · <span style={{ color: '#f59e0b' }}>⚠ .doc</span> — suportado, sem preview no navegador
              </div>
            </div>
          </div>

          {/* Preview do documento */}
          {previewDestacado && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Preview do Documento</label>
                <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓ {validas.length} válidas</span>
                  {invalidas.length > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>✗ {invalidas.length} inválidas</span>}
                  <span style={{ color: 'hsl(var(--text-muted))' }}>{detectadas.length} máscaras detectadas</span>
                </div>
              </div>
              {/* Container estilo página A4 */}
              <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, overflow: 'hidden', background: '#fff', maxHeight: 480, overflowY: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
                <div
                  style={{ padding: '32px 40px', minHeight: 400, color: '#1a1a1a', fontSize: 13, lineHeight: 1.8, fontFamily: 'Georgia, serif' }}
                  dangerouslySetInnerHTML={{ __html: previewDestacado }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 6 }}>
                🟢 Máscaras válidas destacadas em verde · 🔴 Máscaras inválidas em vermelho
              </div>
            </div>
          )}

          {/* Se não tem docx, editor de texto simples */}
          {!modoDocx && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Template do Documento (texto) *</label>
                <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓ {validas.length} válidas</span>
                  {invalidas.length > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>✗ {invalidas.length} inválidas</span>}
                  <span style={{ color: 'hsl(var(--text-muted))' }}>{detectadas.length} máscaras detectadas</span>
                </div>
              </div>
              <textarea
                className="form-input"
                value={templateTexto}
                onChange={e => setTemplateTexto(e.target.value)}
                rows={12}
                style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7, resize: 'vertical' }}
                placeholder="Cole ou escreva o template aqui. Use <<codigo>> para as máscaras..."
              />
            </div>
          )}

          {/* Validação inline */}
          {detectadas.length > 0 && (
            <div style={{ padding: '14px 16px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Shield size={14} color="#818cf8" />VALIDAÇÃO DE MÁSCARAS
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {detectadas.map(cod => {
                  const ok = codigosValidos.includes(cod)
                  return (
                    <span key={cod} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: ok ? '#10b981' : '#f87171', border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                      {ok ? '✓' : '✗'} {cod}
                    </span>
                  )
                })}
              </div>
              {invalidas.length > 0 && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
                  ⚠ Máscaras inválidas não serão substituídas. Cadastre-as no Dicionário ou corrija os códigos.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!nome.trim() || (!templateTexto.trim() && !arquivoBase64)}
            onClick={() => onSave({ nome, tipo: tipoFinal, segmento, unidade, status, descricao, templateTexto, arquivoBase64, arquivoNome, versao: (doc?.versao ?? 0) + 1, mascarasDetectadas: detectadas, mascarasInvalidas: invalidas })}>
            <Check size={14} />{doc ? 'Salvar Alterações' : 'Cadastrar Modelo'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── Geração de PDF via janela de impressão ──────────────────────────────────
function gerarPDF(conteudo: string, nomeDoc: string, nomeAluno: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${nomeDoc} — ${nomeAluno}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: white; color: #1a1a1a; }
    body { font-family: 'Crimson Text', Georgia, serif; font-size: 13pt; line-height: 1.9; padding: 0; }
    .page {
      width: 210mm; min-height: 297mm;
      margin: 0 auto;
      padding: 25mm 20mm 25mm 25mm;
      position: relative;
    }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 14px; margin-bottom: 28px;
      border-bottom: 2px solid #1a1a1a;
    }
    .header-school { font-family: 'Inter', sans-serif; }
    .header-school .name { font-size: 14pt; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px; }
    .header-school .sub { font-size: 9pt; color: #555; margin-top: 2px; font-weight: 400; }
    .header-doc-id { font-family: 'Inter', monospace; font-size: 8pt; color: #888; text-align: right; }
    .doc-title {
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 32px;
      padding: 10px 0;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
    }
    .body-text {
      white-space: pre-wrap;
      word-break: break-word;
      text-align: justify;
      hyphens: auto;
    }
    .footer {
      position: fixed; bottom: 15mm; left: 25mm; right: 20mm;
      border-top: 1px solid #ccc;
      padding-top: 6px;
      display: flex; justify-content: space-between;
      font-family: 'Inter', sans-serif; font-size: 8pt; color: #888;
    }
    @media print {
      html, body { background: white; }
      .page { width: 100%; margin: 0; padding: 15mm 20mm 25mm 25mm; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-school">
        <div class="name">Colégio Impacto</div>
        <div class="sub">Sistema de Gestão Educacional — IMPACTO EDU</div>
      </div>
      <div class="header-doc-id">
        <div>${nomeDoc}</div>
        <div>Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
      </div>
    </div>
    <div class="doc-title">${nomeDoc}</div>
    <div class="body-text">${conteudo.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')}</div>
    <div class="footer">
      <span>Documento gerado automaticamente pelo IMPACTO EDU</span>
      <span>${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); }<\/script>
</body>
</html>`)
  win.document.close()
}

function ModalGerar({ doc, onClose, alunos, turmas, onGerado, mapeamentos }: {
  doc: DocumentoModelo; onClose: () => void
  alunos: any[]; turmas: any[]
  onGerado: (h: Omit<HistoricoGeracao, 'id'>) => void
  mapeamentos: MapeamentoUsuario[]
}) {
  const [alunoId, setAlunoId] = useState('')
  const [busca, setBusca] = useState('')
  const [preview, setPreview] = useState('')
  const [gerando, setGerando] = useState(false)

  const alunosFiltrados = useMemo(() => {
    if (!busca) return alunos.slice(0, 20)
    const q = busca.toLowerCase()
    return alunos.filter(a => a.nome?.toLowerCase().includes(q) || a.matricula?.includes(busca)).slice(0, 20)
  }, [alunos, busca])

  const alunoSel = alunos.find(a => a.id === alunoId)
  const turmaSel = turmas.find(t => t.id === alunoSel?.turmaId || t.nome === alunoSel?.turma)

  const gerarPreview = () => {
    if (!alunoSel) return
    if (doc.arquivoBase64) {
      // Preview baseado no texto extraído do docx
      setPreview(substituir(doc.templateTexto, alunoSel, turmaSel, mapeamentos))
    } else {
      setPreview(substituir(doc.templateTexto, alunoSel, turmaSel, mapeamentos))
    }
  }

  const handleGerar = async () => {
    if (!alunoSel) return
    setGerando(true)
    try {
      if (doc.arquivoBase64) {
        // Modo DOCX: usa docxtemplater para substituir no arquivo real
        const PizZip = (await import('pizzip')).default
        const Docxtemplater = (await import('docxtemplater')).default

        // Decodifica base64 → binário
        const binaryStr = atob(doc.arquivoBase64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

        const zip = new PizZip(bytes)
        const docxDoc = new Docxtemplater(zip, {
          delimiters: { start: '<<', end: '>>' },
          paragraphLoop: true,
          linebreaks: true,
        })

        const data = resolverParaDocx(alunoSel, turmaSel, mapeamentos)
        docxDoc.setData(data)
        docxDoc.render()

        const output = docxDoc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })

        // Download
        const url = URL.createObjectURL(output)
        const a = document.createElement('a')
        a.href = url
        a.download = `${doc.nome} - ${alunoSel.nome ?? 'aluno'}.docx`
        a.click()
        URL.revokeObjectURL(url)

        onGerado({ documentoId: doc.id, documentoNome: doc.nome, alunoId: alunoSel.id, alunoNome: alunoSel.nome ?? '', geradoEm: new Date().toISOString(), usuario: 'Sistema', status: 'sucesso', conteudoGerado: '[DOCX gerado]' })
        onClose()
      } else {
        // Modo texto: gera PDF via impressão
        const conteudo = preview || substituir(doc.templateTexto, alunoSel, turmaSel, mapeamentos)
        gerarPDF(conteudo, doc.nome, alunoSel.nome ?? '')
        onGerado({ documentoId: doc.id, documentoNome: doc.nome, alunoId: alunoSel.id, alunoNome: alunoSel.nome ?? '', geradoEm: new Date().toISOString(), usuario: 'Sistema', status: 'sucesso', conteudoGerado: conteudo })
        onClose()
      }
    } catch (err: any) {
      alert(`Erro ao gerar documento: ${err?.message ?? 'Erro desconhecido'}. Verifique se o arquivo Word está no formato .docx e não está corrompido.`)
      console.error(err)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 800, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.7)', marginBottom: 24 }}>
        <div style={{ padding: '18px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(59,130,246,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={18} color="#10b981" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Gerar Documento</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                {doc.nome} · v{doc.versao}
                {doc.arquivoBase64 && <span style={{ marginLeft: 8, color: '#818cf8', fontWeight: 700 }}>📄 DOCX</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={16} /></button>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {doc.arquivoBase64 && (
            <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, fontSize: 12 }}>
              📄 Documento Word original: <strong>{doc.arquivoNome}</strong><br />
              <span style={{ color: 'hsl(var(--text-muted))' }}>As máscaras serão substituídas apenas nos textos, mantendo imagens, tabelas e formatação intactos. O arquivo será baixado como .docx.</span>
            </div>
          )}

          <div>
            <label className="form-label">Selecionar Aluno *</label>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar aluno pelo nome ou matrícula..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, background: 'hsl(var(--bg-elevated))' }}>
              {alunosFiltrados.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-muted))' }}>Nenhum aluno encontrado</div>
              ) : alunosFiltrados.map(a => (
                <div key={a.id} onClick={() => { setAlunoId(a.id); setBusca(a.nome); setPreview('') }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))', background: alunoId === a.id ? 'rgba(99,102,241,0.08)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nome}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.turma || a.turmaId || '—'} · {a.matricula || a.id}</div>
                  </div>
                  {alunoId === a.id && <Check size={14} color="#10b981" />}
                </div>
              ))}
            </div>
          </div>

          {alunoId && !doc.arquivoBase64 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={gerarPreview}>
                <Eye size={13} />Gerar Pré-visualização
              </button>
            </div>
          )}

          {preview && !doc.arquivoBase64 && (
            <div>
              <label className="form-label">Pré-visualização do Documento</label>
              <textarea
                className="form-input"
                value={preview}
                onChange={e => setPreview(e.target.value)}
                rows={12}
                style={{ fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.8, resize: 'vertical', background: 'rgba(255,255,255,0.03)' }}
              />
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Você pode editar o texto acima antes de baixar.</div>
            </div>
          )}

          {preview && detectarMascaras(preview).length > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, fontSize: 12 }}>
              <span style={{ color: '#f59e0b', fontWeight: 700 }}>⚠ Máscaras não substituídas: </span>
              {detectarMascaras(preview).join(', ')}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!alunoId || gerando} onClick={handleGerar}>
            {gerando ? 'Gerando...' : doc.arquivoBase64 ? <><Download size={14} />Gerar .docx</> : <><Download size={14} />Gerar PDF</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DocumentosEscolares() {
  const { alunos, turmas } = useData()
  const [documentos, setDocumentos] = useLocalStorage<DocumentoModelo[]>('edu-documentos-modelos', [])
  const [mascaras, setMascaras] = useLocalStorage<Mascara[]>('edu-mascaras-dict', MASCARAS_PADRAO)
  const [historico, setHistorico] = useLocalStorage<HistoricoGeracao[]>('edu-docs-historico', [])
  const [mapeamentosUsuario, setMapeamentosUsuario] = useLocalStorage<MapeamentoUsuario[]>('edu-mascaras-mapeamentos', [])
  // Evita hydration mismatch: localStorage só existe no cliente
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    // Auto-corrige duplicatas acumuladas no localStorage
    setMascaras(prev => {
      const seen = new Set<string>()
      const dedup = prev.filter(m => { if (seen.has(m.codigo)) return false; seen.add(m.codigo); return true })
      return dedup.length === prev.length ? prev : dedup
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [tab, setTab] = useState<'modelos' | 'mascaras' | 'historico'>('modelos')
  const [showModal, setShowModal] = useState(false)
  const [editDoc, setEditDoc] = useState<DocumentoModelo | null>(null)
  const [gerarDoc, setGerarDoc] = useState<DocumentoModelo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showMapear, setShowMapear] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  // Máscaras
  const [novaMascara, setNovaMascara] = useState({ codigo: '', descricao: '', categoria: 'aluno' })
  const [mascBusca, setMascBusca] = useState('')
  const xlsxRef = useRef<HTMLInputElement>(null)

  const docsFiltered = useMemo(() => {
    let list = documentos
    if (filtroStatus !== 'todos') list = list.filter(d => d.status === filtroStatus)
    if (filtroTipo !== 'todos') list = list.filter(d => d.tipo === filtroTipo)
    if (filtroSeg !== 'todos') list = list.filter(d => d.segmento === filtroSeg || d.segmento === 'Todos')
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(d => d.nome.toLowerCase().includes(q) || d.tipo.toLowerCase().includes(q))
    }
    return list
  }, [documentos, filtroStatus, filtroTipo, filtroSeg, busca])

  const tiposUsados = useMemo(() => [...new Set(documentos.map(d => d.tipo))], [documentos])

  const handleSave = (data: Omit<DocumentoModelo, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const now = new Date().toISOString()
    if (editDoc) {
      setDocumentos(prev => prev.map(d => d.id === editDoc.id ? { ...d, ...data, atualizadoEm: now } : d))
    } else {
      setDocumentos(prev => [...prev, { ...data, id: `DOC${Date.now()}`, criadoEm: now, atualizadoEm: now }])
    }
    setShowModal(false); setEditDoc(null)
  }

  const handleDelete = (id: string) => {
    setDocumentos(prev => prev.filter(d => d.id !== id))
    setConfirmDelete(null)
  }

  const handleImportXlsxMascaras = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = ev.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // Converte para array de arrays, pulando o header
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        let count = 0
        const novos: { codigo: string; descricao: string; categoria: string; ativo: boolean }[] = []
        rows.slice(1).forEach(row => {
          const [col0, col1, col2] = row.map(c => String(c ?? '').trim())
          if (!col0 || !col1) return
          const codigo = col0.startsWith('<<') ? col0 : `<<${col0}>>`
          if (mascaras.some(m => m.codigo === codigo)) return
          novos.push({ codigo, descricao: col1, categoria: col2 || 'aluno', ativo: true })
          count++
        })
        if (novos.length > 0) setMascaras(prev => [...prev, ...novos])
        alert(`✓ ${count} máscara(s) importada(s) com sucesso!`)
      } catch (err) {
        alert('Erro ao processar arquivo. Verifique o formato e tente novamente.')
        console.error(err)
      }
    }
    reader.readAsBinaryString(f)
    e.target.value = ''
  }

  const downloadModeloXlsx = () => {
    const csv = 'codigo,descricao,categoria\n' + mascaras.map(m => `${m.codigo},${m.descricao},${m.categoria}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'dicionario_mascaras.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const adicionarMascara = () => {
    if (!novaMascara.codigo || !novaMascara.descricao) return
    const codigo = novaMascara.codigo.startsWith('<<') ? novaMascara.codigo : `<<${novaMascara.codigo}>>`
    if (mascaras.some(m => m.codigo === codigo)) return
    setMascaras(prev => [...prev, { ...novaMascara, codigo, ativo: true }])
    setNovaMascara({ codigo: '', descricao: '', categoria: 'aluno' })
  }

  const mascFiltered = useMemo(() => {
    // Deduplica por codigo (caso o localStorage tenha duplicatas por import repetido)
    const seen = new Set<string>()
    const deduped = mascaras.filter(m => { if (seen.has(m.codigo)) return false; seen.add(m.codigo); return true })
    if (!mascBusca) return deduped
    const q = mascBusca.toLowerCase()
    return deduped.filter(m => m.codigo.includes(q) || m.descricao?.toLowerCase().includes(q))
  }, [mascaras, mascBusca])

  const COR_CAT: Record<string, string> = { aluno: '#3b82f6', escola: '#10b981', data: '#f59e0b', financeiro: '#8b5cf6' }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Documentos Escolares</h1>
          <p className="page-subtitle">Motor de geração automática · Máscaras inteligentes · Histórico completo</p>
        </div>
        {tab === 'modelos' && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditDoc(null); setShowModal(true) }}>
            <Plus size={13} />Novo Modelo
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Modelos Cadastrados', value: documentos.length, color: '#6366f1', icon: '📄' },
          { label: 'Modelos Ativos', value: documentos.filter(d => d.status === 'ativo').length, color: '#10b981', icon: '✅' },
          { label: 'Máscaras no Dicionário', value: mascaras.filter(m => m.ativo).length, color: '#3b82f6', icon: '🔑' },
          { label: 'Documentos Gerados', value: historico.length, color: '#f59e0b', icon: '📋' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }} suppressHydrationWarning>{mounted ? k.value : '—'}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 0 }}>
        {([
          { key: 'modelos', label: 'Modelos de Documentos', icon: <FileText size={14} /> },
          { key: 'mascaras', label: 'Dicionário de Máscaras', icon: <Tag size={14} /> },
          { key: 'historico', label: 'Histórico de Geração', icon: <Clock size={14} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 800 : 500, background: tab === t.key ? 'hsl(var(--bg-elevated))' : 'transparent', color: tab === t.key ? '#818cf8' : 'hsl(var(--text-muted))', borderBottom: tab === t.key ? '2px solid #818cf8' : '2px solid transparent', transition: 'all 0.15s' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: MODELOS ── */}
      {tab === 'modelos' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" style={{ paddingLeft: 28, fontSize: 12 }} placeholder="Buscar por nome ou tipo..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos os tipos</option>
              {tiposUsados.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroSeg} onChange={e => setFiltroSeg(e.target.value)}>
              <option value="todos">Todos segmentos</option>
              {SEGMENTOS.filter(s => s !== 'Todos').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}>
              <option value="todos">Todos status</option>
              <option value="ativo">✓ Ativos</option>
              <option value="inativo">✗ Inativos</option>
            </select>
            {(busca || filtroTipo !== 'todos' || filtroSeg !== 'todos' || filtroStatus !== 'todos') && (
              <button className="btn btn-ghost btn-sm" style={{ color: '#f87171', fontSize: 11 }} onClick={() => { setBusca(''); setFiltroTipo('todos'); setFiltroSeg('todos'); setFiltroStatus('todos') }}>✕ Limpar</button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--text-muted))' }}>{docsFiltered.length}/{documentos.length} modelo(s)</span>
          </div>

          {documentos.length === 0 ? (
            <div style={{ padding: '64px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 16, color: 'hsl(var(--text-muted))' }}>
              <FileText size={52} style={{ opacity: 0.08, margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Nenhum modelo cadastrado</div>
              <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto 20px' }}>
                Crie modelos de documentos com máscaras inteligentes. O sistema substitui automaticamente os dados dos alunos.
              </div>
              <button className="btn btn-primary" onClick={() => { setEditDoc(null); setShowModal(true) }}><Plus size={14} />Criar primeiro modelo</button>
            </div>
          ) : docsFiltered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhum modelo com esses filtros.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {docsFiltered.map(doc => {
                const invalCount = doc.mascarasInvalidas?.length ?? 0
                const validCount = (doc.mascarasDetectadas?.length ?? 0) - invalCount
                return (
                  <div key={doc.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${doc.status === 'ativo' ? '#6366f1' : '#6b7280'}`, transition: 'transform 0.15s', cursor: 'default' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nome}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 700 }}>{doc.tipo}</span>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{doc.segmento}</span>
                          </div>
                        </div>
                        <span className={`badge ${doc.status === 'ativo' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10, marginLeft: 8, flexShrink: 0 }}>
                          {doc.status === 'ativo' ? '✓ Ativo' : '✗ Inativo'}
                        </span>
                      </div>

                      {doc.descricao && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 10 }}>{doc.descricao}</div>}

                      {/* Info linha */}
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 10, flexWrap: 'wrap' }}>
                        <span>v{doc.versao}</span>
                        <span>{doc.mascarasDetectadas?.length ?? 0} máscaras</span>
                        {invalCount > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>✗ {invalCount} inválida(s)</span>}
                        {invalCount === 0 && (doc.mascarasDetectadas?.length ?? 0) > 0 && <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Todas válidas</span>}
                      </div>

                      {/* Preview pequeno */}
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-elevated))', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', lineHeight: 1.5, maxHeight: 56, overflow: 'hidden', borderLeft: '3px solid rgba(99,102,241,0.3)' }}>
                        {doc.templateTexto.substring(0, 120)}...
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ padding: '8px 12px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 4, background: 'hsl(var(--bg-overlay))' }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 11, color: '#10b981' }} onClick={() => setGerarDoc(doc)}>
                        <Play size={11} />Gerar
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => { setEditDoc(doc); setShowModal(true) }}>
                        <Pencil size={11} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} title="Excluir" onClick={() => setConfirmDelete(doc.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: MÁSCARAS ── */}
      {tab === 'mascaras' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" style={{ paddingLeft: 28, fontSize: 12 }} placeholder="Buscar máscara..." value={mascBusca} onChange={e => setMascBusca(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)' }} onClick={() => setShowMapear(true)}>
              <Link2 size={13} />Mapear Máscaras
            </button>
            <button className="btn btn-secondary btn-sm" onClick={downloadModeloXlsx}><Download size={13} />Exportar CSV</button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={13} />Importar CSV
              <input ref={xlsxRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleImportXlsxMascaras} />
            </label>
            <button className="btn btn-ghost btn-sm" style={{ color: '#f87171', fontSize: 11 }} onClick={() => { if (confirm('Restaurar dicionário padrão?')) setMascaras(MASCARAS_PADRAO) }}>
              <RefreshCw size={11} />Restaurar padrão
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', fontSize: 11, borderColor: 'rgba(239,68,68,0.3)', border: '1px solid' }}
              onClick={() => { if (confirm('Tem certeza que deseja EXCLUIR TODAS as máscaras do dicionário? Esta ação não pode ser desfeita.')) setMascaras([]) }}>
              <Trash2 size={11} />Excluir Todas
            </button>
          </div>

          {/* Info box */}
          <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, marginBottom: 16, fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: '#818cf8' }}>ℹ Sobre o Dicionário de Máscaras</span><br />
            O XLSX/CSV <strong>NÃO contém dados</strong> dos alunos. Ele funciona como um <strong>dicionário de códigos</strong>: registra quais máscaras existem e o que cada uma significa.
            O sistema usa mapeamento interno para buscar os dados reais e fazer a substituição automática.
          </div>

          {/* Adicionar nova */}
          <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label className="form-label">Código (máscara)</label>
              <input className="form-input" value={novaMascara.codigo} onChange={e => setNovaMascara(p => ({ ...p, codigo: e.target.value }))} placeholder="<<minha_mascara>>" style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </div>
            <div style={{ flex: 3, minWidth: 200 }}>
              <label className="form-label">Descrição</label>
              <input className="form-input" value={novaMascara.descricao} onChange={e => setNovaMascara(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Nome completo do responsável" />
            </div>
            <div style={{ minWidth: 120 }}>
              <label className="form-label">Categoria</label>
              <select className="form-input" style={{ fontSize: 11 }} value={novaMascara.categoria} onChange={e => setNovaMascara(p => ({ ...p, categoria: e.target.value }))}>
                <option>Aluno</option>
                <option>Ensalamento</option>
                <option>Portaria</option>
                <option>Curso</option>
                <option>Módulo</option>
                <option>Pai</option>
                <option>Mãe</option>
                <option>Responsável Pedagógico</option>
                <option>Filiação Pedagógico</option>
                <option>Responsável Financeiro</option>
                <option>Filiação Financeiro</option>
                <option>Dados Financeiro</option>
                <option>Descr Parcelas</option>
                <option>Descr Mensalidades</option>
                <option>Outro Evento</option>
                <option>Itens Parcelas</option>
                <option>Carta Cobrança</option>
                <option>Doc Pendentes</option>
                <option>Ocorrências</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={adicionarMascara}>
              <Plus size={13} />Adicionar
            </button>
          </div>

          {/* Lista de máscaras */}
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Código</th><th>Descrição</th><th>Categoria</th><th>Mapeado</th><th>Status</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {mascFiltered.map(m => (
                  <tr key={m.codigo}>
                    <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 8px', borderRadius: 4, color: '#818cf8', fontWeight: 700 }}>{m.codigo}</code></td>
                    <td style={{ fontSize: 13 }}>{m.descricao}</td>
                    <td>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${COR_CAT[m.categoria ?? 'aluno'] ?? '#6b7280'}20`, color: COR_CAT[m.categoria ?? 'aluno'] ?? '#6b7280', fontWeight: 700 }}>
                        {m.categoria ?? 'aluno'}
                      </span>
                    </td>
                    <td>
                      {MAPA_INTERNO[m.codigo]
                        ? <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>✓ Sim</span>
                        : <span style={{ color: '#6b7280', fontSize: 12 }}>— Não</span>}
                    </td>
                    <td>
                      <button onClick={() => setMascaras(prev => prev.map(x => x.codigo === m.codigo ? { ...x, ativo: !x.ativo } : x))}
                        style={{ padding: '2px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: m.ativo ? 'rgba(16,185,129,0.12)' : 'hsl(var(--bg-overlay))', color: m.ativo ? '#10b981' : 'hsl(var(--text-muted))' }}>
                        {m.ativo ? '✓ Ativo' : '✗ Inativo'}
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }}
                        onClick={() => setMascaras(prev => prev.filter(x => x.codigo !== m.codigo))}><Trash2 size={11} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: HISTÓRICO ── */}
      {tab === 'historico' && (
        <>
          {historico.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <Clock size={44} style={{ opacity: 0.1, margin: '0 auto 14px' }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Nenhum documento gerado ainda</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Data/Hora</th><th>Documento</th><th>Aluno</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>
                  {[...historico].reverse().map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(h.geradoEm).toLocaleString('pt-BR')}</td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{h.documentoNome}</td>
                      <td style={{ fontSize: 13 }}>{h.alunoNome}</td>
                      <td><span className={`badge ${h.status === 'sucesso' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10 }}>{h.status}</span></td>
                      <td>
                        {h.conteudoGerado && (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                            onClick={() => gerarPDF(h.conteudoGerado!, h.documentoNome, h.alunoNome)}>
                            <Download size={11} />PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" style={{ color: '#f87171', fontSize: 11 }} onClick={() => { if (confirm('Limpar todo o histórico?')) setHistorico([]) }}>
                  <Trash2 size={11} />Limpar histórico
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {showModal && (
        <ModalDocumento
          doc={editDoc}
          onClose={() => { setShowModal(false); setEditDoc(null) }}
          onSave={handleSave}
          mascaras={mascaras}
        />
      )}

      {gerarDoc && (
        <ModalGerar
          doc={gerarDoc}
          onClose={() => setGerarDoc(null)}
          alunos={alunos}
          turmas={turmas}
          mapeamentos={mapeamentosUsuario}
          onGerado={h => setHistorico(prev => [...prev, { ...h, id: `HG${Date.now()}` }])}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 14, width: 400, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
            <div style={{ padding: '14px 24px', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid hsl(var(--border-subtle))', fontWeight: 700, color: '#f87171', display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <AlertTriangle size={15} />Excluir Modelo
            </div>
            <div style={{ padding: '18px 24px', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
              Este modelo e seu template serão removidos permanentemente. Esta ação não pode ser desfeita.
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showMapear && (
        <ModalMapear
          mascaras={mascaras}
          mapeamentos={mapeamentosUsuario}
          onClose={() => setShowMapear(false)}
          onSave={maps => { setMapeamentosUsuario(maps); setShowMapear(false) }}
          alunoDemo={alunos[0]}
        />
      )}
    </div>
  )
}
