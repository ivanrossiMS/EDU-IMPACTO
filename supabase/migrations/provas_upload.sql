-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Sistema de Provas via Upload
-- Execute este SQL no Supabase SQL Editor para criar as tabelas necessárias
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Tabela principal de provas por upload
CREATE TABLE IF NOT EXISTS provas_upload (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  instrucoes      TEXT,
  data_aplicacao  DATE,
  data_limite_upload DATE,
  id_bimestre     TEXT,
  series          JSONB DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'aguardando',
    -- Valores: aguardando | em_revisao | aprovado | reprovado | publicado
  questoes_count  INT DEFAULT 0,
  questoes_json   JSONB DEFAULT '[]'::jsonb,
  criado_por      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de atribuições: professor responsável por disciplina dentro de uma prova
CREATE TABLE IF NOT EXISTS provas_upload_requisicoes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_prova_upload UUID NOT NULL REFERENCES provas_upload(id) ON DELETE CASCADE,
  id_disciplina   TEXT,
  disciplina_nome TEXT,
  id_professor    TEXT NOT NULL,
  professor_nome  TEXT,
  qtd_questoes    INT DEFAULT 10,
  status          TEXT NOT NULL DEFAULT 'pendente',
    -- Valores: pendente | enviado | aprovado | reprovado
  enviado_em      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_provas_upload_status       ON provas_upload (status);
CREATE INDEX IF NOT EXISTS idx_provas_upload_criado_por   ON provas_upload (criado_por);
CREATE INDEX IF NOT EXISTS idx_provas_upload_reqs_prova   ON provas_upload_requisicoes (id_prova_upload);
CREATE INDEX IF NOT EXISTS idx_provas_upload_reqs_prof    ON provas_upload_requisicoes (id_professor);

-- 4. Habilitar RLS (opcional - descomente se necessário)
-- ALTER TABLE provas_upload ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE provas_upload_requisicoes ENABLE ROW LEVEL SECURITY;

-- Permissões para service role (anon e autenticado)
GRANT ALL ON provas_upload TO anon, authenticated;
GRANT ALL ON provas_upload_requisicoes TO anon, authenticated;
