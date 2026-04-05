/**
 * lib/banking/types.ts
 * Tipos TypeScript do módulo bancário — server-only
 */

// ─── Pagador (Sacado) ─────────────────────────────────────────────────────────
export interface Pagador {
  nome: string
  cpfCnpj: string          // somente dígitos
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
  cep: string              // somente dígitos
}

// ─── Input para emissão ───────────────────────────────────────────────────────
export interface TituloEmissaoInput {
  // Pagador
  pagador: Pagador
  // Dados do título
  numeroDocumento: string
  descricao: string
  especie: string          // REC, NF, DM, DS, RC
  aceite: string           // A | N
  dataDocumento: string    // YYYY-MM-DD
  dataVencimento: string   // YYYY-MM-DD
  valor: number            // em reais, ex: 1000.00
  desconto: number
  abatimento: number
  percJuros: number        // % ao dia
  percMulta: number        // %
  dataLimiteDesconto?: string
  instrucao1: string
  instrucao2?: string
  tipoProtesto: string     // '0'=sem, '1'=Xd corridos, '2'=Xd úteis, '3'=devolver
  diasProtesto: number
  competencia?: string
  // Vínculos
  alunoId: string
  alunoNome: string
  responsavelNome: string
  convenioId: string
  // Nosso número (se já gerado; senão a API gera)
  nossoNumero?: string
}

// ─── Configuração bancária ─────────────────────────────────────────────────────
export interface ConvenioBancario {
  id: string
  banco: string            // '341' = Itaú
  nomeBanco: string
  agencia: string          // 4 dígitos sem DV
  digitoAgencia: string
  conta: string            // 5 dígitos sem DV
  digitoConta: string
  convenio: string         // Código do Beneficiário (7 dígitos)
  cedente: string          // Razão Social
  cnpj: string             // somente dígitos
  carteira: string         // '109' | '112' | '175'
  instrucoes: string
  nossoNumeroSequencial: number
  situacao: 'ativo' | 'inativo'
  ambiente: 'producao' | 'homologacao'
}

// ─── Campo livre calculado ─────────────────────────────────────────────────────
export interface CampoLivreInput {
  carteira: string
  nossoNumero: string      // 8 dígitos sem DV
  dvNossoNumero: number
  agencia: string          // 4 dígitos
  conta: string            // 5 dígitos
  dvAgenciaConta: number
}

// ─── Código de barras input ────────────────────────────────────────────────────
export interface CodigoBarrasInput {
  banco: string            // '341'
  moeda: string            // '9'
  fatorVencimento: string  // 4 dígitos
  valor: number
  campoLivre: string       // 25 dígitos
}

// ─── Resultado de validação ────────────────────────────────────────────────────
export interface ValidationResult {
  valido: boolean
  erros: string[]          // bloqueantes
  avisos: string[]         // não bloqueantes
}

// ─── Boleto completo (retorno da API) ─────────────────────────────────────────
export interface BoletoCompleto {
  // Dados bancários gerados server-side
  nossoNumero: string
  nossoNumeroDV: number
  nossoNumeroFormatado: string
  codigoBarras44: string
  linhaDigitavel: string
  linhaDigitavelFormatada: string
  fatorVencimento: string
  campoLivre: string
  // Payload original
  payload: TituloEmissaoInput
  convenio: ConvenioBancario
  // Auditoria
  geradoEm: string
  geradoPor?: string
}

// ─── Registro de retorno CNAB 240 ─────────────────────────────────────────────
export interface RegistroRetorno240 {
  nossoNumero: string
  numeroDocumento: string
  ocorrencia: string         // '02', '06', '09', '14'...
  descricaoOcorrencia: string
  dataOcorrencia: string     // YYYYMMDD
  dataVencimento: string
  valorTitulo: number
  valorPago?: number
  dataPagamento?: string
  motivoRejeicao?: string
}

// ─── Evento de auditoria ──────────────────────────────────────────────────────
export interface EventoCobranca {
  id: string
  data: string              // ISO
  tipo: 'emissao' | 'remessa' | 'retorno' | 'baixa' | 'rejeicao' | 'alteracao'
  descricao: string
  operador?: string
  payload?: string          // JSON stringificado
}

// ─── Arquivo CNAB gerado ──────────────────────────────────────────────────────
export interface ArquivoRemessa {
  id: string
  filename: string
  convenioId: string
  dataCriacao: string
  totalTitulos: number
  valorTotal: number
  titulosIds: string[]
  conteudo: string
  status: 'gerado' | 'enviado' | 'processado'
}

// ─── TituloCobranca (modelo estendido — compatível com Titulo existente) ───────
export interface TituloCobranca {
  id: string
  // Dados bancários (server-generated — imutáveis após emissão)
  nossoNumero?: string
  nossoNumeroDV?: number
  nossoNumeroFormatado?: string
  codigoBarras44?: string
  linhaDigitavel?: string
  linhaDigitavelFormatada?: string
  fatorVencimento?: string
  numeroDocumento?: string
  // Pagador (responsável financeiro)
  pagadorNome?: string
  pagadorCpfCnpj?: string
  pagadorLogradouro?: string
  pagadorNumero?: string
  pagadorComplemento?: string
  pagadorBairro?: string
  pagadorCidade?: string
  pagadorUF?: string
  pagadorCEP?: string
  // Valores
  valor: number
  desconto?: number
  abatimento?: number
  percJuros?: number
  percMulta?: number
  dataLimiteDesconto?: string
  // Datas
  dataDocumento?: string
  dataVencimento?: string    // YYYY-MM-DD (redundante com vencimento)
  dataProcessamento?: string
  // Configuração bancária
  especie?: string
  aceite?: string
  instrucao1?: string
  instrucao2?: string
  tipoProtesto?: string
  diasProtesto?: number
  descricao?: string
  competencia?: string
  // Vínculos
  alunoId?: string
  alunoNome?: string
  responsavelNome?: string
  convenioId?: string
  carteira?: string
  // Status estendido
  statusBancario?: 'rascunho' | 'emitido' | 'enviado_remessa' | 'registrado' | 'liquidado' | 'baixado' | 'vencido' | 'rejeitado'
  idBanco?: string
  remessaArquivo?: string
  retornoOcorrencia?: string
  retornoDescricao?: string
  eventos?: EventoCobranca[]
  // ── Campos compat. com Titulo legado ──
  aluno: string
  responsavel: string
  vencimento: string         // YYYY-MM-DD
  pagamento: string | null
  status: 'pago' | 'pendente' | 'atrasado'
  metodo: string | null
  parcela: string
  criadoEm?: string
  atualizadoEm?: string
}
