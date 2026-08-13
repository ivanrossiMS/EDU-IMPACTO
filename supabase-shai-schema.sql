-- MIGRATION: CRIAÇÃO DAS TABELAS DO MÓDULO SHAI NO SUPABASE
-- Execute este script no SQL Editor do seu Painel Supabase se as tabelas ainda não existirem.

CREATE TABLE IF NOT EXISTS shai_colaboradores (
  id TEXT PRIMARY KEY,
  unidade TEXT,
  nome TEXT NOT NULL,
  cpf TEXT,
  data_nascimento TEXT,
  whatsapp TEXT,
  codigo TEXT,
  status TEXT DEFAULT 'pendente',
  enviado_em TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shai_configuracoes (
  id TEXT PRIMARY KEY DEFAULT 'default',
  mensagem_template TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Políticas de Segurança (RLS)
ALTER TABLE shai_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shai_configuracoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura e escrita shai_colaboradores') THEN
    CREATE POLICY "Permitir leitura e escrita shai_colaboradores" ON shai_colaboradores FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura e escrita shai_configuracoes') THEN
    CREATE POLICY "Permitir leitura e escrita shai_configuracoes" ON shai_configuracoes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
