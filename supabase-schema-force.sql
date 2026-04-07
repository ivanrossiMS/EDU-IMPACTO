-- ============================================================
-- ERP IMPACTO EDU — FORCE RECREATE SCRIPT
-- Esse script DESCARTE tabelas vazias antigas e recria a 
-- arquitetura limpa com as colunas certas do App.
-- ============================================================

-- 1. DESTRUIR AS VERSÕES ANTIGAS E SUAS DEPENDÊNCIAS
DROP TABLE IF EXISTS titulos CASCADE;
DROP TABLE IF EXISTS contas_pagar CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS mantenedores CASCADE;
DROP TABLE IF EXISTS movimentacoes CASCADE;
DROP TABLE IF EXISTS fornecedores CASCADE;
DROP TABLE IF EXISTS ocorrencias CASCADE;
DROP TABLE IF EXISTS lancamentos_nota CASCADE;
DROP TABLE IF EXISTS frequencias CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS comunicados CASCADE;
DROP TABLE IF EXISTS documentos_modelos CASCADE;

-- 2. RECRIAR TABELAS COMPLETAS

CREATE TABLE titulos (
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

CREATE TABLE contas_pagar (
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

CREATE TABLE leads (
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

CREATE TABLE mantenedores (
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

CREATE TABLE movimentacoes (
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

CREATE TABLE fornecedores (
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

CREATE TABLE ocorrencias (
  id TEXT PRIMARY KEY,
  aluno_id TEXT DEFAULT '',
  tipo_id TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  data TEXT DEFAULT '',
  status TEXT DEFAULT 'aberta',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lancamentos_nota (
  id TEXT PRIMARY KEY,
  aluno_id TEXT DEFAULT '',
  turma_id TEXT DEFAULT '',
  disciplina TEXT DEFAULT '',
  periodo TEXT DEFAULT '',
  nota NUMERIC,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE frequencias (
  id TEXT PRIMARY KEY,
  aluno_id TEXT DEFAULT '',
  turma_id TEXT DEFAULT '',
  data TEXT DEFAULT '',
  presente BOOLEAN DEFAULT true,
  justificativa TEXT DEFAULT '',
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_logs (
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

CREATE TABLE agendamentos (
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

CREATE TABLE comunicados (
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

CREATE TABLE documentos_modelos (
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
-- LIBERANDO O RLS
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

CREATE POLICY "Allow all operations on titulos" ON titulos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on contas_pagar" ON contas_pagar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on mantenedores" ON mantenedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on movimentacoes" ON movimentacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ocorrencias" ON ocorrencias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on lancamentos_nota" ON lancamentos_nota FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on frequencias" ON frequencias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on system_logs" ON system_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on agendamentos" ON agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on comunicados" ON comunicados FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on documentos_modelos" ON documentos_modelos FOR ALL USING (true) WITH CHECK (true);
