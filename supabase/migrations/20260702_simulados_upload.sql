-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Sistema de Simulados via Upload
-- Execute este SQL no Supabase SQL Editor para criar as tabelas necessárias
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Tabela principal de simulados por upload
CREATE TABLE IF NOT EXISTS simulados_upload (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  instrucoes      TEXT,
  data_aplicacao  DATE,
  data_limite_upload DATE,
  valor           NUMERIC,
  id_bimestre     TEXT,
  series          JSONB DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'aguardando',
    -- Valores: aguardando | em_revisao | asimuladodo | resimuladodo | publicado
  questoes_count  INT DEFAULT 0,
  questoes_json   JSONB DEFAULT '[]'::jsonb,
  criado_por      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de atribuições: professor responsável por disciplina dentro de um simulado
CREATE TABLE IF NOT EXISTS simulados_upload_requisicoes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_simulado_upload UUID NOT NULL REFERENCES simulados_upload(id) ON DELETE CASCADE,
  id_disciplina   TEXT,
  disciplina_nome TEXT,
  id_professor    TEXT NOT NULL,
  professor_nome  TEXT,
  qtd_questoes    INT DEFAULT 10,
  status          TEXT NOT NULL DEFAULT 'pendente',
    -- Valores: pendente | enviado | asimuladodo | resimuladodo
  enviado_em      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_simulados_upload_status       ON simulados_upload (status);
CREATE INDEX IF NOT EXISTS idx_simulados_upload_criado_por   ON simulados_upload (criado_por);
CREATE INDEX IF NOT EXISTS idx_simulados_upload_reqs_simulado   ON simulados_upload_requisicoes (id_simulado_upload);
CREATE INDEX IF NOT EXISTS idx_simulados_upload_reqs_prof    ON simulados_upload_requisicoes (id_professor);

-- Permissões para service role (anon e autenticado)
GRANT ALL ON simulados_upload TO anon, authenticated;
GRANT ALL ON simulados_upload_requisicoes TO anon, authenticated;
