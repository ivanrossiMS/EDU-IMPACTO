import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  type OrcamentoCategoriaItem,
  type RecorrenciaFixaEscolar,
  CATEGORIAS_ESCOLARES,
  calcularValorLiquido,
  normalizarContaPagar,
} from '@/app/(app)/financeiro/pagar/types'

export const dynamic = 'force-dynamic'

const CFG_KEY_CONTAS = 'fin_contas_pagar_v1'
const CFG_KEY_FORNECEDORES = 'fin_fornecedores_pagar_v1'
const CFG_KEY_ORCAMENTOS = 'fin_orcamento_pagar_v1'
const CFG_KEY_RECORRENTES = 'fin_recorrentes_pagar_v1'

function offsetDateISO(base: Date, daysOffset: number): string {
  const d = new Date(base.getTime() + daysOffset * 86400000)
  return d.toISOString().split('T')[0]
}

function monthOffsetCompetencia(base: Date, monthsOffset: number): { competencia: string; dateStr: (day: number) => string } {
  const d = new Date(base.getFullYear(), base.getMonth() + monthsOffset, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return {
    competencia: `${y}-${m}`,
    dateStr: (day: number) => {
      const maxDay = new Date(y, d.getMonth() + 1, 0).getDate()
      const safeDay = Math.min(Math.max(1, day), maxDay)
      return `${y}-${m}-${String(safeDay).padStart(2, '0')}`
    },
  }
}

function buildDefaultFornecedores(): FornecedorEscolar[] {
  return [
    {
      id: 'forn-folha-docente',
      nome: 'Folha de Pagamento — Corpo Docente & Coordenação',
      nomeFantasia: 'Folha Docente Impacto',
      documento: '00.000.000/0001-91',
      categoriaPadrao: 'Pessoal & Corpo Docente',
      centroCustoPadrao: 'Fundamental Anos Finais',
      formaPagamentoPadrao: 'Transferência / TED',
      banco: 'Banco do Brasil (001)',
      agencia: '1234-5',
      contaCorrente: '99887-0',
      chavePix: 'rh@impactoedu.com.br',
      tipoPix: 'E-mail',
      contatoNome: 'Depto. Pessoal / RH',
      telefone: '(91) 98800-1100',
      email: 'dp@impactoedu.com.br',
      avaliacao: 5,
      ativo: true,
    },
    {
      id: 'forn-editora-sistema',
      nome: 'Editora & Sistema de Ensino Integrado S.A.',
      nomeFantasia: 'Sistema de Ensino (Material Didático)',
      documento: '12.345.678/0001-40',
      categoriaPadrao: 'Material Didático & Pedagógico',
      centroCustoPadrao: 'Ensino Médio & Pré-Vestibular',
      formaPagamentoPadrao: 'Boleto Bancário',
      banco: 'Itaú Unibanco (341)',
      chavePix: '12.345.678/0001-40',
      tipoPix: 'CNPJ',
      contatoNome: 'Consultoria Pedagógica Regional',
      telefone: '(11) 4004-8899',
      email: 'faturamento@sistemadeensino.com.br',
      avaliacao: 5,
      ativo: true,
    },
    {
      id: 'forn-energia',
      nome: 'Concessionária de Energia Elétrica S.A.',
      nomeFantasia: 'Equatorial / Energia Elétrica',
      documento: '04.895.728/0001-80',
      categoriaPadrao: 'Utilidades (Energia, Água, Internet)',
      centroCustoPadrao: 'Infraestrutura, Limpeza & Segurança',
      formaPagamentoPadrao: 'Débito Automático',
      chavePix: '04.895.728/0001-80',
      tipoPix: 'CNPJ',
      contatoNome: 'Atendimento Corporativo Grandes Clientes',
      telefone: '0800 091 0196',
      email: 'grandesclientes@energia.com.br',
      avaliacao: 4,
      ativo: true,
    },
    {
      id: 'forn-seguranca-limpeza',
      nome: 'Grupo Protege & Conserva Facilities Ltda',
      nomeFantasia: 'Protege Facilities Escolar',
      documento: '28.910.445/0001-19',
      categoriaPadrao: 'Segurança, Portaria & Limpeza',
      centroCustoPadrao: 'Infraestrutura, Limpeza & Segurança',
      formaPagamentoPadrao: 'PIX',
      banco: 'Santander (033)',
      chavePix: '28.910.445/0001-19',
      tipoPix: 'CNPJ',
      contatoNome: 'Carlos Eduardo (Supervisor Operacional)',
      telefone: '(91) 99123-4567',
      email: 'financeiro@protegefacilities.com.br',
      avaliacao: 5,
      ativo: true,
    },
    {
      id: 'forn-tecnologia-erp',
      nome: 'CloudEdu Tecnologia & Conectividade Fibra Ltda',
      nomeFantasia: 'CloudEdu Tech & Fibra',
      documento: '35.671.890/0001-55',
      categoriaPadrao: 'Tecnologia, Sistemas & Licenças',
      centroCustoPadrao: 'Administração & Diretoria Geral',
      formaPagamentoPadrao: 'PIX',
      chavePix: 'financeiro@cloudedu.com.br',
      tipoPix: 'E-mail',
      contatoNome: 'Suporte NOC Escolar',
      telefone: '(11) 97766-5544',
      email: 'cobranca@cloudedu.com.br',
      avaliacao: 5,
      ativo: true,
    },
    {
      id: 'forn-climatizacao',
      nome: 'ClimaFrio Engenharia Térmica e Manutenção Predial Ltda',
      nomeFantasia: 'ClimaFrio Engenharia',
      documento: '19.442.110/0001-08',
      categoriaPadrao: 'Infraestrutura, Aluguel & Manutenção',
      centroCustoPadrao: 'Infraestrutura, Limpeza & Segurança',
      formaPagamentoPadrao: 'PIX',
      chavePix: '19.442.110/0001-08',
      tipoPix: 'CNPJ',
      contatoNome: 'Eng. Roberto Mendes',
      telefone: '(91) 98411-2233',
      email: 'orcamentos@climafrio.eng.br',
      avaliacao: 4,
      ativo: true,
    },
    {
      id: 'forn-marketing',
      nome: 'Agência Impulso Digital Performance Educacional',
      nomeFantasia: 'Impulso Edu Marketing',
      documento: '41.220.339/0001-72',
      categoriaPadrao: 'Marketing & Captação de Alunos',
      centroCustoPadrao: 'Marketing & Captação (Matrículas)',
      formaPagamentoPadrao: 'PIX',
      chavePix: 'pix@impulsoedu.com.br',
      tipoPix: 'E-mail',
      contatoNome: ' Mariana Costa (Account Manager)',
      telefone: '(11) 99881-2200',
      email: 'financeiro@impulsoedu.com.br',
      avaliacao: 5,
      ativo: true,
    },
    {
      id: 'forn-nutricao',
      nome: 'Sabor & Saúde Alimentação Escolar e Nutrição Ltda',
      nomeFantasia: 'Sabor & Saúde Nutrição',
      documento: '15.887.321/0001-64',
      categoriaPadrao: 'Alimentação & Cantina Escolar',
      centroCustoPadrao: 'Educação Infantil',
      formaPagamentoPadrao: 'Boleto Bancário',
      chavePix: '15.887.321/0001-64',
      tipoPix: 'CNPJ',
      contatoNome: 'Nutr. Fernanda Lima',
      telefone: '(91) 98112-3344',
      email: 'pedidos@saboresaude.com.br',
      avaliacao: 5,
      ativo: true,
    },
  ]
}

function buildDefaultOrcamentos(): OrcamentoCategoriaItem[] {
  return CATEGORIAS_ESCOLARES.map((c) => ({
    categoria: c.id,
    metaMensal: c.orcamentoSugeridoMensal,
    alertaPercentual: 85,
  }))
}

function buildDefaultSeedContas(now = new Date()): ContaPagarRecord[] {
  const mAtual = monthOffsetCompetencia(now, 0)
  const mAnt1 = monthOffsetCompetencia(now, -1)
  const mAnt2 = monthOffsetCompetencia(now, -2)
  const mProx = monthOffsetCompetencia(now, 1)
  const hojeStr = offsetDateISO(now, 0)

  const raw: Partial<ContaPagarRecord>[] = [
    // MÊS ATUAL — Pagas, Vencendo Hoje, Pendentes e Vencidas
    {
      id: 'CP-ESC-001',
      codigo: 'CP-2026-001',
      descricao: 'Folha de Pagamento — Corpo Docente e Coordenação Pedagógica',
      fornecedorId: 'forn-folha-docente',
      fornecedorNome: 'Folha de Pagamento — Corpo Docente & Coordenação',
      fornecedorDocumento: '00.000.000/0001-91',
      categoria: 'Pessoal & Corpo Docente',
      subcategoria: 'Salários Docentes',
      centroCusto: 'Fundamental Anos Finais',
      rateio: [
        { centroCusto: 'Educação Infantil', percentual: 20, valor: 17000 },
        { centroCusto: 'Fundamental Anos Iniciais', percentual: 30, valor: 25500 },
        { centroCusto: 'Fundamental Anos Finais', percentual: 30, valor: 25500 },
        { centroCusto: 'Ensino Médio & Pré-Vestibular', percentual: 20, valor: 17000 },
      ],
      tipoCusto: 'fixo',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(1),
      vencimento: mAtual.dateStr(5),
      dataPagamento: mAtual.dateStr(5),
      valorBase: 85000,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 85000,
      valorPago: 85000,
      status: 'pago',
      prioridade: 'critica',
      formaPagamento: 'Transferência / TED',
      caixaOrigem: 'Banco do Brasil — Conta Movimento',
      numeroDocumento: `FOLHA-${mAtual.competencia}`,
      tipoDocumento: 'Folha',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
      aprovadoPor: 'Diretoria Financeira',
      observacoes: 'Remessa bancária de salários docentes processada via CNAB 240.',
    },
    {
      id: 'CP-ESC-002',
      codigo: 'CP-2026-002',
      descricao: 'Guia FGTS e INSS Patronal — Competência Mensal',
      fornecedorId: 'forn-folha-docente',
      fornecedorNome: 'Receita Federal / Caixa Econômica (FGTS & GPS)',
      fornecedorDocumento: '00.394.460/0058-87',
      categoria: 'Encargos Sociais & Trabalhistas',
      subcategoria: 'INSS / FGTS / PIS Folha',
      centroCusto: 'Administração & Diretoria Geral',
      tipoCusto: 'fixo',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(2),
      vencimento: offsetDateISO(now, 0), // Vence HOJE para demonstrar alerta ativo
      valorBase: 24850,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 24850,
      status: 'pendente',
      prioridade: 'critica',
      formaPagamento: 'PIX',
      numeroDocumento: `DARF-FGTS-${mAtual.competencia}`,
      tipoDocumento: 'DARF',
      linhaDigitavel: '85810000248-5 50000109202-4 60000817263-1 90128371928-0',
      chavePix: '00.394.460/0058-87',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
      aprovadoPor: 'Diretoria Geral',
      observacoes: 'Guia FGTS Digital + DARF Previdenciário unificado (eSocial). Vencimento improrrogável.',
    },
    {
      id: 'CP-ESC-003',
      codigo: 'CP-2026-003',
      descricao: 'Coleção Didática Bimestral & Plataforma Digital de Questões (Lote 04/06)',
      fornecedorId: 'forn-editora-sistema',
      fornecedorNome: 'Editora & Sistema de Ensino Integrado S.A.',
      fornecedorDocumento: '12.345.678/0001-40',
      categoria: 'Material Didático & Pedagógico',
      subcategoria: 'Livros e Apostilas Escolares',
      centroCusto: 'Ensino Médio & Pré-Vestibular',
      rateio: [
        { centroCusto: 'Fundamental Anos Iniciais', percentual: 25, valor: 4700 },
        { centroCusto: 'Fundamental Anos Finais', percentual: 35, valor: 6580 },
        { centroCusto: 'Ensino Médio & Pré-Vestibular', percentual: 40, valor: 7520 },
      ],
      tipoCusto: 'variavel',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(3),
      vencimento: offsetDateISO(now, 3), // Vence em 3 dias
      valorBase: 19200,
      desconto: 400,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 18800,
      status: 'agendado',
      prioridade: 'alta',
      formaPagamento: 'Boleto Bancário',
      numeroDocumento: 'NF-98412 / BOL-04',
      tipoDocumento: 'NF-e',
      notaFiscal: '000.098.412',
      linhaDigitavel: '34191.79001 01043.510047 91020.150008 8 96850001880000',
      chavePix: '12.345.678/0001-40',
      parcelaAtual: 4,
      totalParcelas: 6,
      grupoParcelamentoId: 'GRP-SISTEMA-ENSINO-2026',
      aprovacaoStatus: 'aprovado',
      aprovadoPor: 'Coordenação Pedagógica & Finanças',
      observacoes: 'Desconto contratual de R$ 400,00 por pontualidade até o vencimento.',
    },
    {
      id: 'CP-ESC-004',
      codigo: 'CP-2026-004',
      descricao: 'Fatura de Energia Elétrica — Campus Principal (Salas Climatizadas & Laboratórios)',
      fornecedorId: 'forn-energia',
      fornecedorNome: 'Concessionária de Energia Elétrica S.A.',
      fornecedorDocumento: '04.895.728/0001-80',
      categoria: 'Utilidades (Energia, Água, Internet)',
      subcategoria: 'Energia Elétrica',
      centroCusto: 'Infraestrutura, Limpeza & Segurança',
      tipoCusto: 'variavel',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(4),
      vencimento: offsetDateISO(now, -2), // Vencida há 2 dias para demonstrar gestão de atraso
      valorBase: 7640,
      desconto: 0,
      juros: 38.2,
      multa: 152.8,
      retencaoImpostos: 0,
      valor: 7831,
      status: 'vencido',
      prioridade: 'critica',
      formaPagamento: 'Boleto Bancário',
      numeroDocumento: `UC-882910-${mAtual.competencia}`,
      tipoDocumento: 'Fatura',
      linhaDigitavel: '83640000007-1 83100048957-2 28000180202-9 60512938471-3',
      chavePix: '04.895.728/0001-80',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
      observacoes: 'Consumo elevado devido ao uso intensivo dos aparelhos de ar-condicionado no turno da tarde.',
    },
    {
      id: 'CP-ESC-005',
      codigo: 'CP-2026-005',
      descricao: 'Contrato Terceirizado de Portaria Controlada, Vigilância e Limpeza Escolar',
      fornecedorId: 'forn-seguranca-limpeza',
      fornecedorNome: 'Grupo Protege & Conserva Facilities Ltda',
      fornecedorDocumento: '28.910.445/0001-19',
      categoria: 'Segurança, Portaria & Limpeza',
      subcategoria: 'Portaria e Higienização',
      centroCusto: 'Infraestrutura, Limpeza & Segurança',
      tipoCusto: 'fixo',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(5),
      vencimento: offsetDateISO(now, 5),
      valorBase: 11500,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 1265, // ISS 5% + INSS 6% retido na fonte
      detalhesRetencao: {
        iss: 575,
        irrf: 115,
        inss: 575,
        pisCofinsCsll: 0,
      },
      valor: 10235,
      status: 'pendente',
      prioridade: 'alta',
      formaPagamento: 'PIX',
      numeroDocumento: 'NFS-e 2026/0419',
      tipoDocumento: 'NFS-e',
      notaFiscal: '202600000000419',
      chavePix: '28.910.445/0001-19',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
      aprovadoPor: 'Gerência Administrativa',
      observacoes: 'Retenção obrigatória de INSS (cessão de mão de obra) e ISS municipal na fonte.',
    },
    {
      id: 'CP-ESC-006',
      codigo: 'CP-2026-006',
      descricao: 'Manutenção Preventiva e Higienização de 38 Aparelhos de Ar-Condicionado Split',
      fornecedorId: 'forn-climatizacao',
      fornecedorNome: 'ClimaFrio Engenharia Térmica e Manutenção Predial Ltda',
      fornecedorDocumento: '19.442.110/0001-08',
      categoria: 'Infraestrutura, Aluguel & Manutenção',
      subcategoria: 'Climatização e PMOC',
      centroCusto: 'Infraestrutura, Limpeza & Segurança',
      tipoCusto: 'variavel',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(6),
      vencimento: offsetDateISO(now, 8),
      valorBase: 4800,
      desconto: 200,
      juros: 0,
      multa: 0,
      retencaoImpostos: 240,
      detalhesRetencao: {
        iss: 240,
        irrf: 0,
        inss: 0,
        pisCofinsCsll: 0,
      },
      valor: 4360,
      status: 'pendente',
      prioridade: 'media',
      formaPagamento: 'PIX',
      numeroDocumento: 'NFS-e 1892 / OS-441',
      tipoDocumento: 'NFS-e',
      notaFiscal: '00001892',
      chavePix: '19.442.110/0001-08',
      aprovacaoStatus: 'pendente_aprovacao',
      observacoes: 'Laudo PMOC assinado pelo engenheiro responsável entregue na secretaria.',
    },
    {
      id: 'CP-ESC-007',
      codigo: 'CP-2026-007',
      descricao: 'Licenciamento Plataforma ERP Escolar, Portal do Aluno & Link Fibra Dedicado 1Gbps',
      fornecedorId: 'forn-tecnologia-erp',
      fornecedorNome: 'CloudEdu Tecnologia & Conectividade Fibra Ltda',
      fornecedorDocumento: '35.671.890/0001-55',
      categoria: 'Tecnologia, Sistemas & Licenças',
      subcategoria: 'SaaS & Conectividade',
      centroCusto: 'Administração & Diretoria Geral',
      tipoCusto: 'fixo',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(2),
      vencimento: mAtual.dateStr(10),
      dataPagamento: mAtual.dateStr(9),
      valorBase: 3650,
      desconto: 150,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 3500,
      valorPago: 3500,
      status: 'pago',
      prioridade: 'alta',
      formaPagamento: 'PIX',
      caixaOrigem: 'Itaú — Conta Operacional',
      numeroDocumento: 'NFS-e 7731',
      tipoDocumento: 'NFS-e',
      chavePix: 'financeiro@cloudedu.com.br',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
      aprovadoPor: 'Diretoria Geral',
    },
    {
      id: 'CP-ESC-008',
      codigo: 'CP-2026-008',
      descricao: 'Campanha Tráfego Pago & Captação de Matrículas (Google Ads + Meta Ads + Outdoor)',
      fornecedorId: 'forn-marketing',
      fornecedorNome: 'Agência Impulso Digital Performance Educacional',
      fornecedorDocumento: '41.220.339/0001-72',
      categoria: 'Marketing & Captação de Alunos',
      subcategoria: 'Mídia Digital e Performance',
      centroCusto: 'Marketing & Captação (Matrículas)',
      tipoCusto: 'investimento',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(5),
      vencimento: offsetDateISO(now, 12),
      valorBase: 5400,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 81,
      detalhesRetencao: {
        iss: 0,
        irrf: 81,
        inss: 0,
        pisCofinsCsll: 0,
      },
      valor: 5319,
      status: 'pendente',
      prioridade: 'media',
      formaPagamento: 'PIX',
      numeroDocumento: 'NFS-e 904',
      tipoDocumento: 'NFS-e',
      chavePix: 'pix@impulsoedu.com.br',
      aprovacaoStatus: 'pendente_aprovacao',
      observacoes: 'Campanha de matrículas abertas e agendamento de visitas pedagógicas.',
    },
    {
      id: 'CP-ESC-009',
      codigo: 'CP-2026-009',
      descricao: 'Fornecimento de Lanches Saudáveis e Insumos Nutricionais — Educação Infantil & Integral',
      fornecedorId: 'forn-nutricao',
      fornecedorNome: 'Sabor & Saúde Alimentação Escolar e Nutrição Ltda',
      fornecedorDocumento: '15.887.321/0001-64',
      categoria: 'Alimentação & Cantina Escolar',
      subcategoria: 'Merenda e Nutrição Infantil',
      centroCusto: 'Educação Infantil',
      tipoCusto: 'variavel',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(4),
      vencimento: offsetDateISO(now, 1), // Vence amanhã
      valorBase: 6200,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 6200,
      status: 'pendente',
      prioridade: 'alta',
      formaPagamento: 'Boleto Bancário',
      numeroDocumento: 'NF-e 44510',
      tipoDocumento: 'NF-e',
      notaFiscal: '000.044.510',
      chavePix: '15.887.321/0001-64',
      aprovacaoStatus: 'aprovado',
      aprovadoPor: 'Coordenação Educação Infantil',
    },

    // MÊS ANTERIOR (-1) — Histórico consolidado para análise de evolução e DRE
    {
      id: 'CP-ESC-010',
      codigo: 'CP-2026-010',
      descricao: 'Folha de Pagamento — Corpo Docente e Coordenação Pedagógica',
      fornecedorId: 'forn-folha-docente',
      fornecedorNome: 'Folha de Pagamento — Corpo Docente & Coordenação',
      fornecedorDocumento: '00.000.000/0001-91',
      categoria: 'Pessoal & Corpo Docente',
      centroCusto: 'Fundamental Anos Finais',
      rateio: [
        { centroCusto: 'Educação Infantil', percentual: 20, valor: 16800 },
        { centroCusto: 'Fundamental Anos Iniciais', percentual: 30, valor: 25200 },
        { centroCusto: 'Fundamental Anos Finais', percentual: 30, valor: 25200 },
        { centroCusto: 'Ensino Médio & Pré-Vestibular', percentual: 20, valor: 16800 },
      ],
      tipoCusto: 'fixo',
      competencia: mAnt1.competencia,
      dataEmissao: mAnt1.dateStr(1),
      vencimento: mAnt1.dateStr(5),
      dataPagamento: mAnt1.dateStr(5),
      valorBase: 84000,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 84000,
      valorPago: 84000,
      status: 'pago',
      prioridade: 'critica',
      formaPagamento: 'Transferência / TED',
      caixaOrigem: 'Banco do Brasil — Conta Movimento',
      numeroDocumento: `FOLHA-${mAnt1.competencia}`,
      tipoDocumento: 'Folha',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
    },
    {
      id: 'CP-ESC-011',
      codigo: 'CP-2026-011',
      descricao: 'Guia FGTS e INSS Patronal — Competência Mensal',
      fornecedorId: 'forn-folha-docente',
      fornecedorNome: 'Receita Federal / Caixa Econômica (FGTS & GPS)',
      fornecedorDocumento: '00.394.460/0058-87',
      categoria: 'Encargos Sociais & Trabalhistas',
      centroCusto: 'Administração & Diretoria Geral',
      tipoCusto: 'fixo',
      competencia: mAnt1.competencia,
      dataEmissao: mAnt1.dateStr(2),
      vencimento: mAnt1.dateStr(20),
      dataPagamento: mAnt1.dateStr(19),
      valorBase: 24500,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 24500,
      valorPago: 24500,
      status: 'pago',
      prioridade: 'critica',
      formaPagamento: 'PIX',
      caixaOrigem: 'Banco do Brasil — Conta Movimento',
      numeroDocumento: `DARF-FGTS-${mAnt1.competencia}`,
      tipoDocumento: 'DARF',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
    },
    {
      id: 'CP-ESC-012',
      codigo: 'CP-2026-012',
      descricao: 'Coleção Didática Bimestral & Plataforma Digital de Questões (Lote 03/06)',
      fornecedorId: 'forn-editora-sistema',
      fornecedorNome: 'Editora & Sistema de Ensino Integrado S.A.',
      fornecedorDocumento: '12.345.678/0001-40',
      categoria: 'Material Didático & Pedagógico',
      centroCusto: 'Ensino Médio & Pré-Vestibular',
      tipoCusto: 'variavel',
      competencia: mAnt1.competencia,
      dataEmissao: mAnt1.dateStr(3),
      vencimento: mAnt1.dateStr(15),
      dataPagamento: mAnt1.dateStr(15),
      valorBase: 19200,
      desconto: 400,
      juros: 0,
      multa: 0,
      retencaoImpostos: 0,
      valor: 18800,
      valorPago: 18800,
      status: 'pago',
      prioridade: 'alta',
      formaPagamento: 'Boleto Bancário',
      caixaOrigem: 'Itaú — Conta Operacional',
      numeroDocumento: 'NF-94110 / BOL-03',
      tipoDocumento: 'NF-e',
      parcelaAtual: 3,
      totalParcelas: 6,
      grupoParcelamentoId: 'GRP-SISTEMA-ENSINO-2026',
      aprovacaoStatus: 'aprovado',
    },
    {
      id: 'CP-ESC-013',
      codigo: 'CP-2026-013',
      descricao: 'Contrato Terceirizado de Portaria Controlada, Vigilância e Limpeza Escolar',
      fornecedorId: 'forn-seguranca-limpeza',
      fornecedorNome: 'Grupo Protege & Conserva Facilities Ltda',
      fornecedorDocumento: '28.910.445/0001-19',
      categoria: 'Segurança, Portaria & Limpeza',
      centroCusto: 'Infraestrutura, Limpeza & Segurança',
      tipoCusto: 'fixo',
      competencia: mAnt1.competencia,
      dataEmissao: mAnt1.dateStr(5),
      vencimento: mAnt1.dateStr(15),
      dataPagamento: mAnt1.dateStr(15),
      valorBase: 11500,
      desconto: 0,
      juros: 0,
      multa: 0,
      retencaoImpostos: 1265,
      detalhesRetencao: { iss: 575, irrf: 115, inss: 575, pisCofinsCsll: 0 },
      valor: 10235,
      valorPago: 10235,
      status: 'pago',
      prioridade: 'alta',
      formaPagamento: 'PIX',
      caixaOrigem: 'Itaú — Conta Operacional',
      numeroDocumento: 'NFS-e 2026/0381',
      tipoDocumento: 'NFS-e',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
    },

    // DOIS MESES ATRÁS (-2)
    {
      id: 'CP-ESC-014',
      codigo: 'CP-2026-014',
      descricao: 'Folha de Pagamento — Corpo Docente e Coordenação Pedagógica',
      fornecedorId: 'forn-folha-docente',
      fornecedorNome: 'Folha de Pagamento — Corpo Docente & Coordenação',
      fornecedorDocumento: '00.000.000/0001-91',
      categoria: 'Pessoal & Corpo Docente',
      centroCusto: 'Fundamental Anos Finais',
      tipoCusto: 'fixo',
      competencia: mAnt2.competencia,
      dataEmissao: mAnt2.dateStr(1),
      vencimento: mAnt2.dateStr(5),
      dataPagamento: mAnt2.dateStr(5),
      valorBase: 83200,
      valor: 83200,
      valorPago: 83200,
      status: 'pago',
      prioridade: 'critica',
      formaPagamento: 'Transferência / TED',
      caixaOrigem: 'Banco do Brasil — Conta Movimento',
      numeroDocumento: `FOLHA-${mAnt2.competencia}`,
      tipoDocumento: 'Folha',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
    },
    {
      id: 'CP-ESC-015',
      codigo: 'CP-2026-015',
      descricao: 'Imposto Sobre Serviços (ISSQN Municipal) — Mensalidades Escolares',
      fornecedorNome: 'Prefeitura Municipal — Secretaria de Finanças (DAM ISSQN)',
      fornecedorDocumento: '05.058.441/0001-00',
      categoria: 'Impostos, Taxas & Tributos',
      centroCusto: 'Administração & Diretoria Geral',
      tipoCusto: 'variavel',
      competencia: mAtual.competencia,
      dataEmissao: mAtual.dateStr(5),
      vencimento: offsetDateISO(now, 6),
      valorBase: 8420,
      valor: 8420,
      status: 'pendente',
      prioridade: 'alta',
      formaPagamento: 'PIX',
      numeroDocumento: `DAM-ISS-${mAtual.competencia}`,
      tipoDocumento: 'DARF',
      recorrente: true,
      frequenciaRecorrencia: 'mensal',
      aprovacaoStatus: 'aprovado',
      observacoes: 'Alíquota municipal de 3% sobre faturamento de serviços educacionais.',
    },

    // PRÓXIMO MÊS (+1) — Projeção de Fluxo de Desembolso Futuro
    {
      id: 'CP-ESC-016',
      codigo: 'CP-2026-016',
      descricao: 'Coleção Didática Bimestral & Plataforma Digital de Questões (Lote 05/06)',
      fornecedorId: 'forn-editora-sistema',
      fornecedorNome: 'Editora & Sistema de Ensino Integrado S.A.',
      fornecedorDocumento: '12.345.678/0001-40',
      categoria: 'Material Didático & Pedagógico',
      centroCusto: 'Ensino Médio & Pré-Vestibular',
      tipoCusto: 'variavel',
      competencia: mProx.competencia,
      dataEmissao: mAtual.dateStr(3),
      vencimento: mProx.dateStr(15),
      valorBase: 19200,
      desconto: 400,
      valor: 18800,
      status: 'agendado',
      prioridade: 'alta',
      formaPagamento: 'Boleto Bancário',
      numeroDocumento: 'NF-98412 / BOL-05',
      tipoDocumento: 'NF-e',
      parcelaAtual: 5,
      totalParcelas: 6,
      grupoParcelamentoId: 'GRP-SISTEMA-ENSINO-2026',
      aprovacaoStatus: 'aprovado',
    },
  ]

  return raw.map((r, i) => normalizarContaPagar(r, i, hojeStr))
}

const DEMO_FORNECEDOR_IDS = new Set([
  'forn-folha-docente',
  'forn-editora-sistema',
  'forn-energia',
  'forn-seguranca-limpeza',
  'forn-tecnologia-erp',
  'forn-climatizacao',
  'forn-marketing',
  'forn-nutricao',
])

const DEMO_RECORRENTES_IDS = new Set([
  'tpl-folha-docente',
  'tpl-fgts-inss',
  'tpl-sistema-ensino',
  'tpl-energia-campus',
  'tpl-portaria-limpeza',
  'tpl-erp-fibra',
  'tpl-issqn-municipal',
  'tpl-merenda-infantil',
])

async function loadStateFromDb(admin: any) {
  const hojeStr = new Date().toISOString().split('T')[0]

  const [cfgRes, tableRes, mantRes] = await Promise.all([
    admin
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        CFG_KEY_CONTAS,
        CFG_KEY_FORNECEDORES,
        CFG_KEY_ORCAMENTOS,
        CFG_KEY_RECORRENTES,
        'cfgPlanoContas',
        'cfgCentrosCusto',
        'cfgMetodosPagamento',
        'cfgCaixas',
      ]),
    admin
      .from('contas_pagar')
      .select('*')
      .order('vencimento', { ascending: false })
      .limit(5000)
      .then((r: any) => r, () => ({ data: null, error: { message: 'table_unavailable' } })),
    admin
      .from('mantenedores')
      .select('*')
      .order('nome')
      .then((r: any) => r, () => ({ data: null, error: { message: 'table_unavailable' } })),
  ])

  const cfgMap = new Map<string, any>()
  for (const row of cfgRes.data || []) {
    cfgMap.set(row.chave, row.valor)
  }

  const rawFornecedores: FornecedorEscolar[] = Array.isArray(cfgMap.get(CFG_KEY_FORNECEDORES))
    ? cfgMap.get(CFG_KEY_FORNECEDORES)
    : []

  // Remove fornecedores demonstrativos legados que haviam sido reinseridos automaticamente
  const fornecedores = rawFornecedores.filter((f) => f && f.id && !DEMO_FORNECEDOR_IDS.has(String(f.id)))
  if (fornecedores.length !== rawFornecedores.length) {
    await admin
      .from('configuracoes')
      .upsert(
        { chave: CFG_KEY_FORNECEDORES, valor: fornecedores, updated_at: new Date().toISOString() },
        { onConflict: 'chave' }
      )
      .then(() => {}, () => {})
    ;(globalThis as any).configCache?.clear?.()
  }

  const rawRecorrencias: RecorrenciaFixaEscolar[] = Array.isArray(cfgMap.get(CFG_KEY_RECORRENTES))
    ? cfgMap.get(CFG_KEY_RECORRENTES)
    : []

  const recorrencias = rawRecorrencias.filter((r) => r && r.id && !DEMO_RECORRENTES_IDS.has(String(r.id)))
  if (recorrencias.length !== rawRecorrencias.length) {
    await admin
      .from('configuracoes')
      .upsert(
        { chave: CFG_KEY_RECORRENTES, valor: recorrencias, updated_at: new Date().toISOString() },
        { onConflict: 'chave' }
      )
      .then(() => {}, () => {})
    ;(globalThis as any).configCache?.clear?.()
  }

  const orcamentos: OrcamentoCategoriaItem[] = Array.isArray(cfgMap.get(CFG_KEY_ORCAMENTOS))
    ? cfgMap.get(CFG_KEY_ORCAMENTOS)
    : []

  const hasCfgContas = cfgMap.has(CFG_KEY_CONTAS) && Array.isArray(cfgMap.get(CFG_KEY_CONTAS))
  const cfgContasRaw: any[] = hasCfgContas ? cfgMap.get(CFG_KEY_CONTAS) : []
  const tableContasRaw: any[] = Array.isArray(tableRes?.data) ? tableRes.data : []

  const mergedMap = new Map<string, ContaPagarRecord>()

  if (hasCfgContas) {
    for (const item of cfgContasRaw) {
      const norm = normalizarContaPagar(item, mergedMap.size, hojeStr)
      mergedMap.set(norm.id, norm)
    }
  } else {
    for (const row of tableContasRaw) {
      const unpacked = { ...row, ...(row.dados || {}) }
      const norm = normalizarContaPagar(unpacked, mergedMap.size, hojeStr)
      mergedMap.set(norm.id, norm)
    }
  }

  const contas = Array.from(mergedMap.values()).sort((a, b) =>
    (b.vencimento || '').localeCompare(a.vencimento || '')
  )

  const planoContas: any[] = Array.isArray(cfgMap.get('cfgPlanoContas'))
    ? cfgMap.get('cfgPlanoContas')
    : []

  const centrosCusto: any[] = Array.isArray(cfgMap.get('cfgCentrosCusto'))
    ? cfgMap.get('cfgCentrosCusto')
    : []

  const metodosPagamento: any[] = Array.isArray(cfgMap.get('cfgMetodosPagamento'))
    ? cfgMap.get('cfgMetodosPagamento')
    : []

  const SIMULATED_CAIXAS = new Set(['CX-108', 'CX-102', 'CX-98', 'CX-94', 'CX-19', 'CX-11', 'CX-1'])
  const rawCaixas: any[] = Array.isArray(cfgMap.get('cfgCaixas')) ? cfgMap.get('cfgCaixas') : []
  const caixas = rawCaixas.filter((c: any) => c && typeof c === 'object' && !SIMULATED_CAIXAS.has(String(c.id || '').trim()))
  if (caixas.length !== rawCaixas.length) {
    await admin
      .from('configuracoes')
      .upsert(
        { chave: 'cfgCaixas', valor: caixas, updated_at: new Date().toISOString() },
        { onConflict: 'chave' }
      )
      .then(() => {}, () => {})
    ;(globalThis as any).configCache?.clear?.()
  }

  const mantenedores: any[] = Array.isArray(mantRes?.data)
    ? mantRes.data.map((row: any) => ({
        ...row,
        unidades: row.unidades ?? [],
        ...(row.dados || {}),
      }))
    : []

  return {
    contas,
    fornecedores,
    orcamentos,
    recorrencias,
    planoContas,
    centrosCusto,
    mantenedores,
    metodosPagamento,
    caixas,
  }
}

async function persistContas(admin: any, contas: ContaPagarRecord[], touchedRecords?: ContaPagarRecord[]) {
  const hojeStr = new Date().toISOString().split('T')[0]
  const normalized = contas.map((c, idx) => normalizarContaPagar(c, idx, hojeStr))

  const { error: cfgErr } = await admin
    .from('configuracoes')
    .upsert(
      { chave: CFG_KEY_CONTAS, valor: normalized, updated_at: new Date().toISOString() },
      { onConflict: 'chave' }
    )

  if (cfgErr) {
    throw new Error(cfgErr.message)
  }
  ;(globalThis as any).configCache?.clear?.()

  // Best-effort sync to public.contas_pagar table if it exists in this database
  const toSync = touchedRecords && touchedRecords.length > 0 ? touchedRecords : normalized.slice(0, 100)
  if (toSync.length > 0) {
    const rowsForTable = toSync.map((c) => ({
      id: c.id,
      descricao: c.descricao,
      categoria: c.categoria,
      valor: c.valor,
      vencimento: c.vencimento,
      status: c.status,
      fornecedor: c.fornecedorNome,
      dados: c,
    }))
    await admin
      .from('contas_pagar')
      .upsert(rowsForTable, { onConflict: 'id' })
      .then(() => {}, () => {})
  }

  return normalized
}

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const includeMeta = searchParams.get('includeMeta') === 'true'
    const limit = parseInt(searchParams.get('limit') || '10000', 10)

    const admin = getAdminClient()
    const {
      contas,
      fornecedores,
      orcamentos,
      recorrencias,
      planoContas,
      centrosCusto,
      mantenedores,
      metodosPagamento,
      caixas,
    } = await loadStateFromDb(admin)
    const sliced = contas.slice(0, limit)

    if (includeMeta) {
      return NextResponse.json({
        data: sliced,
        fornecedores,
        orcamentos,
        recorrencias,
        planoContas,
        centrosCusto,
        mantenedores,
        metodosPagamento,
        caixas,
      })
    }

    return NextResponse.json(sliced)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar contas a pagar' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const admin = getAdminClient()
    const hojeStr = new Date().toISOString().split('T')[0]
    const nowISO = new Date().toISOString()
    const operador = user?.email || 'Tesouraria Escolar'

    const state = await loadStateFromDb(admin)
    let contas = [...state.contas]
    let fornecedores = [...state.fornecedores]
    let orcamentos = [...state.orcamentos]
    let recorrencias = [...state.recorrencias]

    const action = body?.action as string | undefined

    // 1. Seed / Restaurar Dados Demonstrativos Escolares
    if (action === 'seed_demo') {
      const demo = buildDefaultSeedContas(new Date())
      const map = new Map<string, ContaPagarRecord>()
      for (const c of contas) map.set(c.id, c)
      for (const d of demo) map.set(d.id, d)
      const saved = await persistContas(admin, Array.from(map.values()), demo)
      return NextResponse.json({ ok: true, data: saved, fornecedores, orcamentos })
    }

    // 1.1 Salvar Recorrência Fixa Escolar
    if (action === 'save_recorrencia') {
      const r = body.recorrencia as Partial<RecorrenciaFixaEscolar>
      if (!r || !r.titulo?.trim()) {
        return NextResponse.json({ error: 'Descrição da recorrência fixa é obrigatória' }, { status: 400 })
      }
      const novaRec: RecorrenciaFixaEscolar = {
        id: r.id || `rec-${Date.now().toString(36)}`,
        titulo: r.titulo.trim(),
        fornecedorId: r.fornecedorId || undefined,
        fornecedorNome: r.fornecedorNome?.trim() || r.titulo.trim(),
        fornecedorDocumento: r.fornecedorDocumento?.trim() || undefined,
        categoria: r.categoria?.trim() || '',
        planoContasId: r.planoContasId || undefined,
        unidadePadrao: r.unidadePadrao?.trim() || undefined,
        centroCusto: r.centroCusto?.trim() || '',
        tipoCusto: r.tipoCusto || 'fixo',
        prioridade: r.prioridade || 'alta',
        diaVencimento: Math.min(31, Math.max(1, Number(r.diaVencimento) || 10)),
        valorEstimado: Math.max(0, Number(r.valorEstimado) || 0),
        formaPagamento: r.formaPagamento?.trim() || 'PIX',
        chavePix: r.chavePix?.trim() || undefined,
        ativo: r.ativo !== false,
      }
      const idx = recorrencias.findIndex((x) => x.id === novaRec.id)
      if (idx >= 0) recorrencias[idx] = novaRec
      else recorrencias.unshift(novaRec)

      const { error: saveRecErr } = await admin
        .from('configuracoes')
        .upsert(
          { chave: CFG_KEY_RECORRENTES, valor: recorrencias, updated_at: nowISO },
          { onConflict: 'chave' }
        )

      if (saveRecErr) {
        throw new Error(saveRecErr.message)
      }
      ;(globalThis as any).configCache?.clear?.()

      return NextResponse.json({ ok: true, recorrencia: novaRec, recorrencias })
    }

    // 1.2 Excluir Recorrência Fixa Escolar
    if (action === 'delete_recorrencia') {
      const recId = String(body.id || '').trim()
      recorrencias = recorrencias.filter((r) => String(r.id) !== recId)
      const { error: delRecErr } = await admin
        .from('configuracoes')
        .upsert(
          { chave: CFG_KEY_RECORRENTES, valor: recorrencias, updated_at: nowISO },
          { onConflict: 'chave' }
        )

      if (delRecErr) {
        throw new Error(delRecErr.message)
      }
      ;(globalThis as any).configCache?.clear?.()

      return NextResponse.json({ ok: true, recorrencias })
    }

    // 2. Salvar Fornecedor Escolar
    if (action === 'save_fornecedor') {
      const f = body.fornecedor as Partial<FornecedorEscolar>
      if (!f || !f.nome) {
        return NextResponse.json({ error: 'Nome do fornecedor é obrigatório' }, { status: 400 })
      }
      const novoForn: FornecedorEscolar = {
        id: f.id || `forn-${Date.now().toString(36)}`,
        nome: f.nome.trim(),
        nomeFantasia: f.nomeFantasia?.trim() || f.nome.trim(),
        documento: f.documento?.trim() || '',
        categoriaPadrao: f.categoriaPadrao || '',
        centroCustoPadrao: f.centroCustoPadrao ?? '',
        unidadePadrao: f.unidadePadrao ?? '',
        tipoCustoPadrao: f.tipoCustoPadrao || 'fixo',
        formaPagamentoPadrao: f.formaPagamentoPadrao || 'PIX',
        banco: f.banco || '',
        agencia: f.agencia || '',
        contaCorrente: f.contaCorrente || '',
        chavePix: f.chavePix || '',
        tipoPix: f.tipoPix || 'CNPJ',
        contatoNome: f.contatoNome || '',
        telefone: f.telefone || '',
        email: f.email || '',
        observacoes: f.observacoes || '',
        avaliacao: Number(f.avaliacao ?? 5),
        ativo: f.ativo !== false,
      }
      const idx = fornecedores.findIndex((x) => x.id === novoForn.id)
      if (idx >= 0) fornecedores[idx] = novoForn
      else fornecedores.unshift(novoForn)

      const { error: saveErr } = await admin
        .from('configuracoes')
        .upsert(
          { chave: CFG_KEY_FORNECEDORES, valor: fornecedores, updated_at: nowISO },
          { onConflict: 'chave' }
        )

      if (saveErr) {
        throw new Error(saveErr.message)
      }
      ;(globalThis as any).configCache?.clear?.()

      return NextResponse.json({ ok: true, fornecedor: novoForn, fornecedores })
    }

    // 3. Excluir Fornecedor Escolar
    if (action === 'delete_fornecedor') {
      const fornId = String(body.id || '').trim()
      const fornNome = String(body.nome || '').trim().toLowerCase()
      fornecedores = fornecedores.filter((f) => {
        if (fornId && String(f.id) === fornId) return false
        if (!fornId && fornNome && String(f.nome || '').trim().toLowerCase() === fornNome) return false
        return true
      })
      const { error: delErr } = await admin
        .from('configuracoes')
        .upsert(
          { chave: CFG_KEY_FORNECEDORES, valor: fornecedores, updated_at: nowISO },
          { onConflict: 'chave' }
        )

      if (delErr) {
        throw new Error(delErr.message)
      }
      ;(globalThis as any).configCache?.clear?.()

      return NextResponse.json({ ok: true, fornecedores })
    }

    // 4. Salvar Metas Orçamentárias por Categoria
    if (action === 'save_orcamentos') {
      if (Array.isArray(body.orcamentos)) {
        orcamentos = body.orcamentos.map((o: any) => ({
          categoria: String(o.categoria),
          metaMensal: Math.max(0, Number(o.metaMensal) || 0),
          alertaPercentual: Math.min(100, Math.max(10, Number(o.alertaPercentual) || 85)),
        }))
        const { error: orcErr } = await admin
          .from('configuracoes')
          .upsert(
            { chave: CFG_KEY_ORCAMENTOS, valor: orcamentos, updated_at: nowISO },
            { onConflict: 'chave' }
          )
        if (orcErr) {
          throw new Error(orcErr.message)
        }
        ;(globalThis as any).configCache?.clear?.()
      }
      return NextResponse.json({ ok: true, orcamentos })
    }

    // 5. Baixa Individual ou Baixa Parcial (Liquidação de Despesa)
    if (action === 'baixa') {
      const id = String(body.id || '')
      const targetIdx = contas.findIndex((c) => c.id === id)
      if (targetIdx < 0) {
        return NextResponse.json({ error: 'Conta a pagar não encontrada' }, { status: 404 })
      }

      const atual = contas[targetIdx]
      const dataPagamento = body.dataPagamento || hojeStr
      const formaPagamento = body.formaPagamento || atual.formaPagamento || 'PIX'
      const caixaOrigem = body.caixaOrigem || 'Banco do Brasil — Conta Movimento'
      const comprovanteRef = body.comprovanteRef || ''
      const observacaoBaixa = body.observacao || ''
      const anexosNovos = Array.isArray(body.anexosNovos) ? body.anexosNovos : []
      const anexosCombinados = [...(atual.anexos || []), ...anexosNovos]
      const jurosExtra = Math.max(0, Number(body.juros ?? atual.juros ?? 0))
      const multaExtra = Math.max(0, Number(body.multa ?? atual.multa ?? 0))
      const descontoExtra = Math.max(0, Number(body.desconto ?? atual.desconto ?? 0))

      const valorLiquidoAtualizado = calcularValorLiquido(
        atual.valorBase,
        descontoExtra,
        jurosExtra,
        multaExtra,
        atual.retencaoImpostos
      )
      const valorPagoInput = Number(body.valorPago ?? valorLiquidoAtualizado)
      const isBaixaParcial = Boolean(body.baixaParcial) && valorPagoInput > 0 && valorPagoInput < valorLiquidoAtualizado - 0.01

      const touched: ContaPagarRecord[] = []

      if (isBaixaParcial) {
        const saldoRemanescente = Math.round((valorLiquidoAtualizado - valorPagoInput) * 100) / 100
        const liquidadaParcial: ContaPagarRecord = normalizarContaPagar(
          {
            ...atual,
            desconto: descontoExtra,
            juros: jurosExtra,
            multa: multaExtra,
            valor: valorPagoInput,
            valorBase: valorPagoInput,
            valorPago: valorPagoInput,
            status: 'pago',
            dataPagamento,
            formaPagamento,
            caixaOrigem,
            comprovanteUrl: comprovanteRef || anexosNovos[0]?.url || atual.comprovanteUrl,
            anexos: anexosCombinados,
            aprovacaoStatus: 'aprovado',
            updatedAt: nowISO,
            historico: [
              ...(atual.historico || []),
              {
                id: `hist-${Date.now()}`,
                data: nowISO,
                acao: 'Baixa Parcial Efetivada',
                usuario: operador,
                detalhes: `Pago R$ ${valorPagoInput.toFixed(2)} via ${formaPagamento} (${caixaOrigem}). Saldo residual de R$ ${saldoRemanescente.toFixed(2)} desmembrado em novo título.${observacaoBaixa ? ` Obs: ${observacaoBaixa}` : ''}`,
              },
            ],
          },
          targetIdx,
          hojeStr
        )

        const novoResidual: ContaPagarRecord = normalizarContaPagar(
          {
            ...atual,
            id: `${atual.id}-RES-${Date.now().toString(36).slice(-4).toUpperCase()}`,
            codigo: `${atual.codigo || 'CP'}-RES`,
            descricao: `${atual.descricao} (Saldo Remanescente)`,
            valorBase: saldoRemanescente,
            desconto: 0,
            juros: 0,
            multa: 0,
            retencaoImpostos: 0,
            valor: saldoRemanescente,
            valorPago: 0,
            status: 'pendente',
            dataPagamento: undefined,
            createdAt: nowISO,
            updatedAt: nowISO,
            historico: [
              {
                id: `hist-res-${Date.now()}`,
                data: nowISO,
                acao: 'Saldo Residual Gerado Automaticamente',
                usuario: operador,
                detalhes: `Gerado a partir da baixa parcial do título ${atual.codigo || atual.id}.`,
              },
            ],
          },
          contas.length,
          hojeStr
        )

        contas[targetIdx] = liquidadaParcial
        contas.unshift(novoResidual)
        touched.push(liquidadaParcial, novoResidual)
      } else {
        const liquidada: ContaPagarRecord = normalizarContaPagar(
          {
            ...atual,
            desconto: descontoExtra,
            juros: jurosExtra,
            multa: multaExtra,
            valor: valorLiquidoAtualizado,
            valorPago: valorPagoInput,
            status: 'pago',
            dataPagamento,
            formaPagamento,
            caixaOrigem,
            comprovanteUrl: comprovanteRef || anexosNovos[0]?.url || atual.comprovanteUrl,
            anexos: anexosCombinados,
            aprovacaoStatus: 'aprovado',
            updatedAt: nowISO,
            historico: [
              ...(atual.historico || []),
              {
                id: `hist-${Date.now()}`,
                data: nowISO,
                acao: 'Liquidação / Baixa Integral',
                usuario: operador,
                detalhes: `Pago R$ ${valorPagoInput.toFixed(2)} via ${formaPagamento} (${caixaOrigem}).${observacaoBaixa ? ` Obs: ${observacaoBaixa}` : ''}`,
              },
            ],
          },
          targetIdx,
          hojeStr
        )
        contas[targetIdx] = liquidada
        touched.push(liquidada)
      }

      // Registra movimentação de saída no caixa (com origem = 'baixa_pagar' para não duplicar no DRE)
      if (body.registrarNoCaixa !== false) {
        const movId = `mov-cp-${id}-${Date.now().toString(36)}`
        await admin
          .from('movimentacoes')
          .upsert(
            {
              id: movId,
              tipo: 'saida',
              categoria: atual.categoria,
              descricao: `Pgto: ${atual.descricao} (${atual.fornecedorNome})`,
              valor: valorPagoInput,
              data: dataPagamento,
              dados: {
                id: movId,
                origem: 'baixa_pagar',
                referenciaId: atual.id,
                fornecedorNome: atual.fornecedorNome,
                formaPagamento,
                caixaOrigem,
                planoContasId: atual.planoContasId || '',
                eventoId: atual.eventoId || '',
                numeroDocumento: atual.numeroDocumento || '',
              },
            },
            { onConflict: 'id' }
          )
          .then(() => {}, () => {})
      }

      const saved = await persistContas(admin, contas, touched)
      return NextResponse.json({ ok: true, data: saved })
    }

    // 6. Baixa em Lote (Liquidação Múltipla)
    if (action === 'baixa_lote') {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : []
      const dataPagamento = body.dataPagamento || hojeStr
      const formaPagamento = body.formaPagamento || 'PIX'
      const caixaOrigem = body.caixaOrigem || 'Banco do Brasil — Conta Movimento'
      const observacao = body.observacao || 'Baixa em lote autorizada pela tesouraria'

      const idSet = new Set(ids)
      const touched: ContaPagarRecord[] = []

      contas = contas.map((c, idx) => {
        if (!idSet.has(c.id) || c.status === 'pago') return c
        const updated = normalizarContaPagar(
          {
            ...c,
            status: 'pago',
            valorPago: c.valor,
            dataPagamento,
            formaPagamento,
            caixaOrigem,
            aprovacaoStatus: 'aprovado',
            updatedAt: nowISO,
            historico: [
              ...(c.historico || []),
              {
                id: `hist-lote-${Date.now()}-${idx}`,
                data: nowISO,
                acao: 'Baixa em Lote Efetivada',
                usuario: operador,
                detalhes: `Liquidado em lote (${formaPagamento} • ${caixaOrigem}). ${observacao}`,
              },
            ],
          },
          idx,
          hojeStr
        )
        touched.push(updated)
        return updated
      })

      const saved = await persistContas(admin, contas, touched)
      return NextResponse.json({ ok: true, data: saved, count: touched.length })
    }

    // 7. Aprovação em Lote pela Diretoria / Controladoria
    if (action === 'aprovar_lote') {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : []
      const idSet = new Set(ids)
      const touched: ContaPagarRecord[] = []

      contas = contas.map((c, idx) => {
        if (!idSet.has(c.id)) return c
        const updated = normalizarContaPagar(
          {
            ...c,
            aprovacaoStatus: 'aprovado',
            aprovadoPor: operador,
            updatedAt: nowISO,
            historico: [
              ...(c.historico || []),
              {
                id: `hist-aprov-${Date.now()}-${idx}`,
                data: nowISO,
                acao: 'Aprovado para Pagamento',
                usuario: operador,
                detalhes: 'Alçada financeira liberada pela diretoria/controladoria.',
              },
            ],
          },
          idx,
          hojeStr
        )
        touched.push(updated)
        return updated
      })

      const saved = await persistContas(admin, contas, touched)
      return NextResponse.json({ ok: true, data: saved, count: touched.length })
    }

    // 8. Estornar / Reverter Baixa
    if (action === 'reverter_baixa') {
      const id = String(body.id || '')
      const touched: ContaPagarRecord[] = []

      contas = contas.map((c, idx) => {
        if (c.id !== id) return c
        const updated = normalizarContaPagar(
          {
            ...c,
            status: c.vencimento < hojeStr ? 'vencido' : 'pendente',
            valorPago: 0,
            dataPagamento: undefined,
            updatedAt: nowISO,
            historico: [
              ...(c.historico || []),
              {
                id: `hist-est-${Date.now()}`,
                data: nowISO,
                acao: 'Estorno de Baixa',
                usuario: operador,
                detalhes: body.motivo || 'Baixa revertida para aberto pela controladoria.',
              },
            ],
          },
          idx,
          hojeStr
        )
        touched.push(updated)
        return updated
      })

      const saved = await persistContas(admin, contas, touched)
      try {
        await admin.from('movimentacoes').delete().like('id', `mov-cp-${id}%`)
        const { data: cfgRows } = await admin
          .from('configuracoes_sistema')
          .select('chave, dados')
          .in('chave', ['fin_movimentacoes_caixa_v1', 'fin_movimentacoes_overrides_v1'])
        const mapCfg = new Map<string, any>()
        ;(cfgRows || []).forEach((r: any) => mapCfg.set(r.chave, r.dados))
        const movsCaixa = Array.isArray(mapCfg.get('fin_movimentacoes_caixa_v1'))
          ? mapCfg.get('fin_movimentacoes_caixa_v1')
          : []
        const filteredCaixa = movsCaixa.filter(
          (m: any) => m.id !== id && m.id !== `CP-${id}` && !String(m.id || '').startsWith(`mov-cp-${id}`)
        )
        if (filteredCaixa.length !== movsCaixa.length) {
          await admin
            .from('configuracoes_sistema')
            .upsert({ chave: 'fin_movimentacoes_caixa_v1', dados: filteredCaixa }, { onConflict: 'chave' })
        }
        const overrides = (mapCfg.get('fin_movimentacoes_overrides_v1') && typeof mapCfg.get('fin_movimentacoes_overrides_v1') === 'object')
          ? { ...mapCfg.get('fin_movimentacoes_overrides_v1') }
          : {}
        overrides[`CP-${id}`] = { ...(overrides[`CP-${id}`] || {}), estornado: true, estornadoEm: nowISO, motivoEstorno: body.motivo || 'Baixa revertida' }
        overrides[id] = { ...(overrides[id] || {}), estornado: true, estornadoEm: nowISO, motivoEstorno: body.motivo || 'Baixa revertida' }
        await admin
          .from('configuracoes_sistema')
          .upsert({ chave: 'fin_movimentacoes_overrides_v1', dados: overrides }, { onConflict: 'chave' })
      } catch {}
      return NextResponse.json({ ok: true, data: saved })
    }

    // 8.1 Atualizar Anexos / Fotos de um Lançamento Individualmente
    if (action === 'update_anexos') {
      const id = String(body.id || '')
      const targetIdx = contas.findIndex((c) => c.id === id)
      if (targetIdx < 0) {
        return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
      }
      const atual = contas[targetIdx]
      const anexos = Array.isArray(body.anexos) ? body.anexos : []
      const acaoHistorico = body.acaoHistorico || 'Anexos Atualizados'
      const detalhesHistorico = body.detalhesHistorico || `Total de anexos no lançamento: ${anexos.length}.`

      const updated = normalizarContaPagar(
        {
          ...atual,
          anexos,
          comprovanteUrl: atual.comprovanteUrl || anexos[0]?.url || undefined,
          updatedAt: nowISO,
          historico: [
            ...(atual.historico || []),
            {
              id: `hist-anx-${Date.now()}`,
              data: nowISO,
              acao: acaoHistorico,
              usuario: operador,
              detalhes: detalhesHistorico,
            },
          ],
        },
        targetIdx,
        hojeStr
      )

      contas[targetIdx] = updated
      const saved = await persistContas(admin, contas, [updated])
      return NextResponse.json({ ok: true, data: saved, record: updated })
    }

    // 9. Upsert de 1 ou Múltiplas Contas a Pagar (Lançamento / Parcelamento / Importação)
    const rawItems: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : [body]

    const mapById = new Map<string, ContaPagarRecord>()
    for (const c of contas) mapById.set(c.id, c)

    const touched: ContaPagarRecord[] = []

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i]
      if (!item || typeof item !== 'object') continue
      const existing = item.id ? mapById.get(String(item.id)) : undefined
      const norm = normalizarContaPagar(
        {
          ...existing,
          ...item,
          updatedAt: nowISO,
          historico:
            item.historico ||
            existing?.historico || [
              {
                id: `hist-init-${Date.now()}-${i}`,
                data: nowISO,
                acao: existing ? 'Título Atualizado' : 'Título Lançado',
                usuario: operador,
                detalhes: `${item.descricao || existing?.descricao || 'Despesa'} — ${item.fornecedorNome || existing?.fornecedorNome || 'Fornecedor'}`,
              },
            ],
        },
        mapById.size + i,
        hojeStr
      )
      mapById.set(norm.id, norm)
      touched.push(norm)
    }

    const finalContas = Array.from(mapById.values()).sort((a, b) =>
      (b.vencimento || '').localeCompare(a.vencimento || '')
    )

    const saved = await persistContas(admin, finalContas, touched)
    return NextResponse.json({ ok: true, data: saved, touched })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao processar operação em Contas a Pagar' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  return POST(request)
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const singleId = searchParams.get('id')
    const multiIds = searchParams.get('ids')

    const idsToDelete = new Set<string>()
    if (singleId) idsToDelete.add(singleId)
    if (multiIds) {
      for (const part of multiIds.split(',')) {
        if (part.trim()) idsToDelete.add(part.trim())
      }
    }

    if (idsToDelete.size === 0) {
      return NextResponse.json({ error: 'ID não informado para exclusão' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { contas } = await loadStateFromDb(admin)
    const remaining = contas.filter((c) => !idsToDelete.has(c.id))

    const saved = await persistContas(admin, remaining, [])

    await admin
      .from('contas_pagar')
      .delete()
      .in('id', Array.from(idsToDelete))
      .then(() => {}, () => {})

    return NextResponse.json({ ok: true, data: saved, deletedCount: idsToDelete.size })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao excluir conta a pagar' }, { status: 500 })
  }
}
