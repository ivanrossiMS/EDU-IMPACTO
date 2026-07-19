-- ═══════════════════════════════════════════════════════════════════════════
-- EDU-IMPACTO — Índices de Performance + Realtime
-- Versão: v2  |  Criado em: 2026-07-17
--
-- INSTRUÇÕES:
--   1. Abrir Supabase Dashboard → SQL Editor → New query
--   2. Colar este arquivo inteiro e executar
--   3. Todos os índices usam IF NOT EXISTS — são seguros para re-executar
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1 (opcional, só se precisar de busca por nome com ilike)
-- Habilitar extensão pg_trgm para índice trigram no campo nome de alunos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: alunos
-- Problema: /api/alunos/lightweight levou 11.5s (11.3s application-code)
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice composto para filtro status + ORDER BY nome
CREATE INDEX IF NOT EXISTS idx_alunos_status_nome
  ON alunos(status, nome)
  WHERE status IS DISTINCT FROM 'inativo';

-- Índice trigram para busca ilike '%texto%' no campo nome
CREATE INDEX IF NOT EXISTS idx_alunos_nome_trgm
  ON alunos USING gin(nome gin_trgm_ops);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: frequencias
-- Problema: fetch abortado por timeout (30s) — tabela sem índice
-- ─────────────────────────────────────────────────────────────────────────────

-- Busca por aluno + ordenação por data
CREATE INDEX IF NOT EXISTS idx_frequencias_aluno_data
  ON frequencias(aluno_id, data DESC);

-- Busca por turma + ordenação por data
CREATE INDEX IF NOT EXISTS idx_frequencias_turma_data
  ON frequencias(turma_id, data DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: momentos
-- Problema: 12.5s (8.0s application-code) — queries JSONB sem índice
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice GIN para queries em JSONB: dados->targetClasses, dados->alunosIds
CREATE INDEX IF NOT EXISTS idx_momentos_dados_gin
  ON momentos USING gin(dados);

-- Índice para ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_momentos_created_at
  ON momentos(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: comunicados
-- Problema: 10.7s (6.1s application-code) — select * + joins pesados
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice GIN para queries em JSONB: dados->targets, dados->aluno_id, etc.
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_gin
  ON comunicados USING gin(dados);

-- Índice para ORDER BY data DESC
CREATE INDEX IF NOT EXISTS idx_comunicados_data_desc
  ON comunicados(data DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: system_logs
-- Problema: filtro por data_hora dos últimos 7 dias sem índice
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_system_logs_data_hora
  ON system_logs(data_hora DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: adiantamentos
-- Problema: fetch abortado por timeout (30s) — tabela sem índice
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_adiantamentos_created_at
  ON adiantamentos(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELAS: agenda_notification_reads e agenda_ciencias
-- Problema: join em comunicados busca por content_id sem índice
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notif_reads_content_id
  ON agenda_notification_reads(content_id);

CREATE INDEX IF NOT EXISTS idx_ciencias_content_id
  ON agenda_ciencias(content_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 2: Verificar RLS ANTES de ativar Realtime
--
-- Todas as tabelas devem mostrar rowsecurity = true.
-- Se alguma mostrar false, não ative o Realtime nela.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  tablename, 
  rowsecurity,
  CASE WHEN rowsecurity THEN 'OK para Realtime' ELSE 'ATIVAR RLS ANTES' END AS status_realtime
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'comunicados', 'ocorrencias', 'boletins',
    'frequencias', 'momentos', 'eventos_agenda'
  )
ORDER BY tablename;


-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 3: Habilitar Realtime nas 6 tabelas com erro nos logs
--
-- SÓ execute após confirmar que todas têm RLS = true no PASSO 2.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE comunicados;
ALTER PUBLICATION supabase_realtime ADD TABLE ocorrencias;
ALTER PUBLICATION supabase_realtime ADD TABLE boletins;
ALTER PUBLICATION supabase_realtime ADD TABLE frequencias;
ALTER PUBLICATION supabase_realtime ADD TABLE momentos;
ALTER PUBLICATION supabase_realtime ADD TABLE eventos_agenda;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL: confirmar que os índices foram criados
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_alunos_status_nome', 'idx_alunos_nome_trgm',
    'idx_frequencias_aluno_data', 'idx_frequencias_turma_data',
    'idx_momentos_dados_gin', 'idx_momentos_created_at',
    'idx_comunicados_dados_gin', 'idx_comunicados_data_desc',
    'idx_system_logs_data_hora', 'idx_adiantamentos_created_at',
    'idx_notif_reads_content_id', 'idx_ciencias_content_id'
  )
ORDER BY tablename, indexname;
