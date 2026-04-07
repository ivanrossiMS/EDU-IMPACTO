-- ============================================================
-- ERP IMPACTO EDU — Migration Script
-- Execute no painel SQL do Supabase (Dashboard > SQL Editor)
-- ============================================================

-- TABELA: titulos (Contas a Receber)
CREATE TABLE IF NOT EXISTS titulos (
  id TEXT PRIMARY KEY,
  aluno TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  vencimento TEXT DEFAULT '',
  pagamento TEXT,
  status TEXT DEFAULT 'pendente',
  metodo TEXT,
  parcela TEXT DEFAULT '',
  evento_id TEXT,
  evento_descricao TEXT,
  centro_custo_id TEXT,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_titulos_status ON titulos(status);
-- CREATE INDEX IF NOT EXISTS idx_titulos_aluno ON titulos(aluno);
-- CREATE INDEX IF NOT EXISTS idx_titulos_vencimento ON titulos(vencimento);

-- TABELA: contas_pagar
CREATE TABLE IF NOT EXISTS contas_pagar (
  id TEXT PRIMARY KEY,
  descricao TEXT DEFAULT '',
  categoria TEXT DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  vencimento TEXT DEFAULT '',
  status TEXT DEFAULT 'pendente',
  fornecedor TEXT DEFAULT '',
  numero_documento TEXT,
  plano_contas_id TEXT,
  centro_custo_id TEXT,
  codigo TEXT,
  usa_rateio BOOLEAN DEFAULT false,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status);
-- CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON contas_pagar(vencimento);

-- TABELA: leads (CRM)
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  nome TEXT DEFAULT '',
  interesse TEXT DEFAULT '',
  origem TEXT DEFAULT '',
  status TEXT DEFAULT 'novo',
  responsavel TEXT DEFAULT '',
  data TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  score_ia INTEGER DEFAULT 0,
  valor_potencial NUMERIC DEFAULT 0,
  notas TEXT DEFAULT '',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- TABELA: mantenedores (Unidades Educacionais)
CREATE TABLE IF NOT EXISTS mantenedores (
  id TEXT PRIMARY KEY,
  nome TEXT DEFAULT '',
  razao_social TEXT DEFAULT '',
  cnpj TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  cargo TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  cidade TEXT DEFAULT '',
  estado TEXT DEFAULT '',
  cep TEXT DEFAULT '',
  unidades JSONB DEFAULT '[]',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: movimentacoes (Caixa + Movimentos Manuais)
CREATE TABLE IF NOT EXISTS movimentacoes (
  id TEXT PRIMARY KEY,
  tipo TEXT DEFAULT 'entrada',
  descricao TEXT DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  data TEXT DEFAULT '',
  categoria TEXT DEFAULT '',
  plano_contas_id TEXT,
  centro_custo_id TEXT,
  status TEXT DEFAULT 'ativo',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data);
-- CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes(tipo);

-- TABELA: fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id TEXT PRIMARY KEY,
  nome TEXT DEFAULT '',
  cnpj TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  categoria TEXT DEFAULT '',
  status TEXT DEFAULT 'ativo',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: ocorrencias
CREATE TABLE IF NOT EXISTS ocorrencias (
  id TEXT PRIMARY KEY,
  aluno_id TEXT DEFAULT '',
  tipo_id TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  data TEXT DEFAULT '',
  status TEXT DEFAULT 'aberta',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_ocorrencias_aluno ON ocorrencias(aluno_id);

-- TABELA: lancamentos_nota
CREATE TABLE IF NOT EXISTS lancamentos_nota (
  id TEXT PRIMARY KEY,
  aluno_id TEXT DEFAULT '',
  turma_id TEXT DEFAULT '',
  disciplina TEXT DEFAULT '',
  periodo TEXT DEFAULT '',
  nota NUMERIC,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_notas_aluno ON lancamentos_nota(aluno_id);
-- CREATE INDEX IF NOT EXISTS idx_notas_turma ON lancamentos_nota(turma_id);

-- TABELA: frequencias
CREATE TABLE IF NOT EXISTS frequencias (
  id TEXT PRIMARY KEY,
  aluno_id TEXT DEFAULT '',
  turma_id TEXT DEFAULT '',
  data TEXT DEFAULT '',
  presente BOOLEAN DEFAULT true,
  justificativa TEXT DEFAULT '',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_frequencias_aluno ON frequencias(aluno_id);
-- CREATE INDEX IF NOT EXISTS idx_frequencias_turma ON frequencias(turma_id);
-- CREATE INDEX IF NOT EXISTS idx_frequencias_data ON frequencias(data);

-- TABELA: system_logs (Auditoria)
CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  usuario_nome TEXT DEFAULT '',
  perfil TEXT DEFAULT '',
  modulo TEXT DEFAULT '',
  acao TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  status TEXT DEFAULT 'sucesso',
  origem TEXT DEFAULT 'sistema',
  registro_id TEXT,
  nome_relacionado TEXT,
  detalhes_antes JSONB,
  detalhes_depois JSONB
);
-- CREATE INDEX IF NOT EXISTS idx_logs_data_hora ON system_logs(data_hora DESC);
-- CREATE INDEX IF NOT EXISTS idx_logs_modulo ON system_logs(modulo);

-- TABELA: agendamentos (CRM)
CREATE TABLE IF NOT EXISTS agendamentos (
  id TEXT PRIMARY KEY,
  titulo TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  data TEXT DEFAULT '',
  hora TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  status TEXT DEFAULT 'agendado',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data);

-- TABELA: comunicados
CREATE TABLE IF NOT EXISTS comunicados (
  id TEXT PRIMARY KEY,
  titulo TEXT DEFAULT '',
  texto TEXT DEFAULT '',
  autor TEXT DEFAULT '',
  data TEXT DEFAULT '',
  destino TEXT DEFAULT 'todos',
  fixado BOOLEAN DEFAULT false,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: documentos_modelos (Templates de Contratos)
CREATE TABLE IF NOT EXISTS documentos_modelos (
  id TEXT PRIMARY KEY,
  titulo TEXT DEFAULT '',
  conteudo TEXT DEFAULT '',
  categoria TEXT DEFAULT '',
  status TEXT DEFAULT 'ativo',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENABLE RLS (Row Level Security) — ajuste conforme seu setup
-- Por ora aberto para autenticação da chave anon
-- ============================================================
ALTER TABLE titulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantenedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_nota ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_modelos ENABLE ROW LEVEL SECURITY;

-- Policies — permissão total via anon key (mesmo padrão das tabelas existentes)
DROP POLICY IF EXISTS "Allow all operations on titulos" ON titulos;
CREATE POLICY "Allow all operations on titulos" ON titulos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on contas_pagar" ON contas_pagar;
CREATE POLICY "Allow all operations on contas_pagar" ON contas_pagar FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on leads" ON leads;
CREATE POLICY "Allow all operations on leads" ON leads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on mantenedores" ON mantenedores;
CREATE POLICY "Allow all operations on mantenedores" ON mantenedores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on movimentacoes" ON movimentacoes;
CREATE POLICY "Allow all operations on movimentacoes" ON movimentacoes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on fornecedores" ON fornecedores;
CREATE POLICY "Allow all operations on fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on ocorrencias" ON ocorrencias;
CREATE POLICY "Allow all operations on ocorrencias" ON ocorrencias FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on lancamentos_nota" ON lancamentos_nota;
CREATE POLICY "Allow all operations on lancamentos_nota" ON lancamentos_nota FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on frequencias" ON frequencias;
CREATE POLICY "Allow all operations on frequencias" ON frequencias FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on system_logs" ON system_logs;
CREATE POLICY "Allow all operations on system_logs" ON system_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on agendamentos" ON agendamentos;
CREATE POLICY "Allow all operations on agendamentos" ON agendamentos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on comunicados" ON comunicados;
CREATE POLICY "Allow all operations on comunicados" ON comunicados FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on documentos_modelos" ON documentos_modelos;
CREATE POLICY "Allow all operations on documentos_modelos" ON documentos_modelos FOR ALL USING (true) WITH CHECK (true);
