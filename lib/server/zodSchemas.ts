import { z } from 'zod'

/**
 * Zod Schemas - Barreira de Sanitização de API
 * Impede que payloads maliciosos ou desconfigurados cheguem ao Banco de Dados.
 */

// Schema Genérico de Paginação p/ Listagens GET
export const APIListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(10000).default(1500),
  search: z.string().optional(),
})

// Schema de Validação de Títulos Financeiros
export const ZodTituloFinanceiro = z.object({
  id: z.string().uuid().optional(),
  valor: z.coerce.number().min(0, "Valor não pode ser negativo"),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vencimento inválido. Formato esperado: YYYY-MM-DD"),
  status: z.enum(['pendente', 'pago', 'cancelado', 'excluido', 'vencido']).default('pendente'),
  descricao: z.string().min(3, "Descrição muito curta").max(300),
  parcelaId: z.string().optional(),
  aluno: z.string().optional(),
  responsavel: z.string().optional(),
  // Permitir schemas extensíveis para o MVP de adaptação (pode ser travado num ERP final)
  dados: z.record(z.string(), z.any()).optional()
}).passthrough()

// Schema de Validação de Responsáveis
export const ZodResponsavel = z.object({
  id: z.string().optional(),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cpf: z.string().nullable().optional(),
  rg: z.string().nullable().optional(),
  org_emissor: z.string().nullable().optional(),
  data_nasc: z.string().nullable().optional(),
  sexo: z.string().nullable().optional(),
  email: z.string().email("Endereço de e-mail inválido").or(z.literal('')).nullable().optional(),
  telefone: z.string().nullable().optional(),
  celular: z.string().nullable().optional(),
  profissao: z.string().nullable().optional(),
  naturalidade: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  nacionalidade: z.string().nullable().optional(),
  estado_civil: z.string().nullable().optional(),
  rfid: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(),
  obs: z.string().nullable().optional(),
  endereco: z.record(z.string(), z.any()).optional(),
  dados: z.record(z.string(), z.any()).optional()
}).passthrough()

// Schema de Validação Estrita de Alunos
export const ZodAluno = z.object({
  id: z.string().optional(),
  nome: z.string().min(3, "O nome do aluno deve ter pelo menos 3 caracteres.").max(100),
  matricula: z.string().optional(),
  turma: z.string().optional(),
  serie: z.string().optional(),
  turno: z.string().optional(),
  status: z.enum(['matriculado', 'inativo', 'transferido', 'evadido', 'formado', 'em_cadastro']).default('matriculado'),
  email: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  responsavel: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  unidade: z.string().nullable().optional(),
  obs: z.string().nullable().optional(),
  inadimplente: z.boolean().default(false),
  risco_evasao: z.enum(['baixo', 'medio', 'alto']).default('baixo'),
  dados: z.record(z.string(), z.any()).optional()
}).passthrough()

// Schema de Validação de Contas a Pagar
export const ZodContaPagar = z.object({
  id: z.string().uuid().optional(),
  descricao: z.string().min(2, "A descrição deve ter pelo menos 2 caracteres."),
  categoria: z.string().optional(),
  valor: z.coerce.number().min(0, "O valor não pode ser negativo."),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, "Formato de data inválido. Use YYYY-MM-DD."),
  status: z.enum(['pendente', 'pago', 'cancelado']).default('pendente'),
  fornecedor: z.string().optional(),
  numero_documento: z.string().nullable().optional(),
  plano_contas_id: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(),
  usa_rateio: z.boolean().default(false),
  dados: z.record(z.string(), z.any()).optional()
}).passthrough()

// Schema de Validação de Caixa Aberta (PDV)
export const ZodCaixa = z.object({
  id: z.string().optional(), // Pode gerar UUID fallback
  codigo: z.string().min(1, "Código obrigatório"),
  nome_caixa: z.string().default("Caixa Padrão"),
  data_abertura: z.string(),
  hora_abertura: z.string(),
  operador: z.string().min(1, "Operador obrigatório"),
  unidade: z.string().nullable().optional(),
  saldo_inicial: z.coerce.number().default(0),
  saldo_final: z.coerce.number().nullable().optional(),
  baixa_outro_usuario: z.boolean().default(false),
  fechado: z.boolean().default(false),
  hora_fechamento: z.string().nullable().optional(),
  dados: z.record(z.string(), z.any()).optional()
}).passthrough()

// Schema de Validação de Movimentações (Lançamentos Diários)
export const ZodMovimentacao = z.object({
  id: z.string().optional(),
  caixa_id: z.string().min(1, "Obrigatório pertencer a um Caixa Aberto/Fechado"),
  tipo: z.enum(['entrada', 'saida', 'suprimento', 'sangria', 'receita', 'despesa']),
  descricao: z.string().min(2, "Descrição muito curta"),
  valor: z.coerce.number().min(0, "O valor transacionado deve ser positivo absoluto"),
  data: z.string(),
  hora: z.string(),
  operador: z.string(),
  plano_contas_id: z.string().optional().nullable(),
  compensado_banco: z.enum(['A Compensar', 'Compensado', 'Não se Aplica']).default('Não se Aplica'),
  dados: z.record(z.string(), z.any()).optional()
}).passthrough()

// ==========================================
// FASE A: MODELOS RELACIONAIS PUROS
// ==========================================

export const ZodFinEvento = z.object({
    id: z.string().uuid().optional(),
    aluno_id: z.string().min(1, "Deve pertencer a um Aluno válido"),
    tipo: z.string(),
    descricao: z.string().min(2),
    plano_contas_id: z.string().nullable().optional(),
    valor_total: z.coerce.number().min(0),
    qtde_parcelas: z.coerce.number().int().min(1),
    status: z.enum(['ativo', 'cancelado', 'concluido']).default('ativo'),
    dados_legados: z.record(z.string(), z.any()).optional()
}).passthrough()

export const ZodFinParcela = z.object({
    id: z.string().uuid().optional(),
    evento_id: z.string().uuid("Deve pertencer a um Evento Base"),
    numero_parcela: z.coerce.number().int().min(1),
    descricao: z.string(),
    vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato yyyy-mm-dd"),
    valor_original: z.coerce.number(),
    desconto: z.coerce.number().default(0),
    juros: z.coerce.number().default(0),
    multa: z.coerce.number().default(0),
    valor_pago: z.coerce.number().nullable().optional(),
    data_pagamento: z.string().nullable().optional(),
    caixa_id: z.string().nullable().optional(),
    status: z.enum(['pendente', 'pago', 'cancelado', 'isento']).default('pendente'),
    responsavel_pagamento: z.string().nullable().optional(),
    dados_legados: z.record(z.string(), z.any()).optional()
}).passthrough()
