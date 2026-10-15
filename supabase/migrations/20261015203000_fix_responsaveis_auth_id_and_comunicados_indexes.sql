-- =============================================================================
-- Migration: 20261015203000_fix_responsaveis_auth_id_and_comunicados_indexes.sql
-- Objetivo:
--   1. Eliminar definitivamente o erro PostgreSQL 42703 ("column responsaveis.auth_id does not exist")
--      adicionando a coluna auth_id UUID em public.responsaveis com backfill automático e índices.
--   2. Eliminar o erro PostgreSQL 57014 ("canceling statement due to statement timeout") em
--      public.comunicados criando índices GIN funcionais nas sub-chaves JSONB consultadas pelo
--      PostgREST (dados->'turmas', dados->'grupos', dados->'alunosIds', etc.) e índice composto
--      de ordenação (data DESC, id DESC).
-- =============================================================================

-- ─── 1. Coluna auth_id e Índices de Busca Rápida em public.responsaveis ──────
ALTER TABLE public.responsaveis
  ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Backfill seguro a partir de dados->>'auth_id' ou dados->>'user_id' quando for UUID válido
UPDATE public.responsaveis
SET auth_id = COALESCE(
  CASE
    WHEN (dados->>'auth_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (dados->>'auth_id')::uuid
    ELSE NULL
  END,
  CASE
    WHEN (dados->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (dados->>'user_id')::uuid
    ELSE NULL
  END
)
WHERE auth_id IS NULL
  AND dados IS NOT NULL
  AND (dados ? 'auth_id' OR dados ? 'user_id');

-- Backfill complementar vinculando com public.system_users (por responsavel_id ou email)
UPDATE public.responsaveis r
SET auth_id = su.auth_id
FROM public.system_users su
WHERE r.auth_id IS NULL
  AND su.auth_id IS NOT NULL
  AND (
    (su.dados->>'responsavel_id') = r.id::text
    OR (r.email IS NOT NULL AND r.email <> '' AND LOWER(TRIM(su.email)) = LOWER(TRIM(r.email)))
  );

-- Índices B-Tree para resolução instantânea de responsáveis no login e OneSignal sync
CREATE INDEX IF NOT EXISTS idx_responsaveis_auth_id
  ON public.responsaveis (auth_id)
  WHERE auth_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_responsaveis_dados_auth_id
  ON public.responsaveis ((dados->>'auth_id'))
  WHERE dados IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_responsaveis_dados_user_id
  ON public.responsaveis ((dados->>'user_id'))
  WHERE dados IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_responsaveis_email_lower
  ON public.responsaveis (LOWER(email))
  WHERE email IS NOT NULL;

-- ─── 2. Índices GIN Funcionais e Composto B-Tree em public.comunicados ───────
-- Índice composto exato para ORDER BY data DESC, id DESC (elimina Sort em memória)
CREATE INDEX IF NOT EXISTS idx_comunicados_data_id_desc
  ON public.comunicados (data DESC, id DESC);

-- Índices GIN nas expressões exatas geradas pelo PostgREST (dados->campo.cs.[...])
-- Muito mais leves e rápidos que indexar o JSONB inteiro (ignoram os 400KB+ de dados->'anexos')
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_turmas_gin
  ON public.comunicados USING gin ((dados->'turmas'));

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_grupos_gin
  ON public.comunicados USING gin ((dados->'grupos'));

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_alunos_gin
  ON public.comunicados USING gin ((dados->'alunosIds'));

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_func_gin
  ON public.comunicados USING gin ((dados->'funcionariosIds'));

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_colab_gin
  ON public.comunicados USING gin ((dados->'colaboradoresIds'));

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_autor_id
  ON public.comunicados ((dados->>'autorId'));

-- Atualizar estatísticas do otimizador de consultas do PostgreSQL
ANALYZE public.responsaveis;
ANALYZE public.comunicados;

-- Recarregar cache de schema do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';
