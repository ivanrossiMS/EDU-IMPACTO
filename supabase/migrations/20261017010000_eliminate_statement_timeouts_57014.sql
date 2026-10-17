-- =============================================================================
-- Migration: 20261017010000_eliminate_statement_timeouts_57014.sql
-- Objetivo:
--   Eliminar definitivamente os erros PostgreSQL 57014 ("canceling statement due to statement timeout")
--   em public.comunicados e public.system_users sob alta concorrência na Agenda Digital.
-- =============================================================================

-- 1. Índice parcial de ordenação excluindo cópias individuais de relatórios de alunos (AD-COM-REL-STU-%)
-- Evita que o PostgreSQL precise varrer milhares de cópias STU ao listar o feed do colaborador/admin
CREATE INDEX IF NOT EXISTS idx_comunicados_feed_non_stu_data_id_desc
  ON public.comunicados (data DESC, id DESC)
  WHERE id NOT LIKE 'AD-COM-REL-STU-%';

-- 2. Índice text_pattern_ops para acelerar filtros id LIKE 'AD-COM-REL-%' e id LIKE 'AD-COM-REL-COLAB-%'
CREATE INDEX IF NOT EXISTS idx_comunicados_id_pattern
  ON public.comunicados (id text_pattern_ops);

-- 3. Índices funcionais B-Tree parciais para campos JSONB filtrados em /api/comunicados
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_status
  ON public.comunicados ((dados->>'status'))
  WHERE id NOT LIKE 'AD-COM-REL-STU-%';

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_tipo
  ON public.comunicados ((dados->>'tipo'))
  WHERE id NOT LIKE 'AD-COM-REL-STU-%';

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_remetente_id
  ON public.comunicados ((dados->>'remetenteId'))
  WHERE id NOT LIKE 'AD-COM-REL-STU-%';

-- 4. Índices de busca rápida para public.system_users (usados em authGuard e ?type=colaboradores)
CREATE INDEX IF NOT EXISTS idx_system_users_nome
  ON public.system_users (nome);

CREATE INDEX IF NOT EXISTS idx_system_users_auth_id
  ON public.system_users (auth_id)
  WHERE auth_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_users_email_lower
  ON public.system_users (LOWER(email))
  WHERE email IS NOT NULL;

ANALYZE public.comunicados;
ANALYZE public.system_users;

NOTIFY pgrst, 'reload schema';
