-- ══════════════════════════════════════════════════════════════════
-- IMPACTO EDU — Performance Indexes
-- Criado em: 2026-07-01
-- Objetivo: Corrigir queries lentas identificadas na análise de logs
-- ══════════════════════════════════════════════════════════════════

-- ── 1. saida_calls ────────────────────────────────────────────────
-- A tabela é filtrada por created_at (data do dia) e por studentId no JSONB.
-- Sem esses índices a query fazia seq-scan em todos os registros.

CREATE INDEX IF NOT EXISTS idx_saida_calls_created_at
  ON saida_calls (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saida_calls_student_id
  ON saida_calls ((dados->>'studentId'));

CREATE INDEX IF NOT EXISTS idx_saida_calls_status
  ON saida_calls ((dados->>'status'));

-- ── 2. comunicados ────────────────────────────────────────────────
-- Filtrada por data (campo raiz) e por destino. Com volume crescente
-- de comunicados, essa index reduz drasticamente o tempo de leitura.

CREATE INDEX IF NOT EXISTS idx_comunicados_data
  ON comunicados (data DESC);

CREATE INDEX IF NOT EXISTS idx_comunicados_destino
  ON comunicados (destino);

-- ── 3. agenda_notification_reads ──────────────────────────────────
-- Usada em JOIN implícito dentro de /api/comunicados para cada comunicado.

CREATE INDEX IF NOT EXISTS idx_notif_reads_content_id
  ON agenda_notification_reads (content_id);

CREATE INDEX IF NOT EXISTS idx_notif_reads_usuario
  ON agenda_notification_reads (usuario_id);

-- ── 4. agenda_ciencias ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agenda_ciencias_content_id
  ON agenda_ciencias (content_id);

-- ── 5. system_users ───────────────────────────────────────────────
-- Buscas por email são frequentes em verificações de perfil.
CREATE INDEX IF NOT EXISTS idx_system_users_email
  ON system_users (email);

-- ── 6. aluno_responsavel ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_aluno_id
  ON aluno_responsavel (aluno_id);

CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_responsavel_id
  ON aluno_responsavel (responsavel_id);

-- ── 7. portaria_eventos ───────────────────────────────────────────
-- Coluna correta é data_hora (não data_inicio)
-- Obs: idx_portaria_ev_data já pode existir da migration inicial — IF NOT EXISTS garante segurança
CREATE INDEX IF NOT EXISTS idx_portaria_ev_data
  ON portaria_eventos (data_hora DESC);

-- ── Analyze tables to update planner statistics ───────────────────
ANALYZE saida_calls;
ANALYZE comunicados;
ANALYZE agenda_notification_reads;
ANALYZE agenda_ciencias;
ANALYZE system_users;
ANALYZE aluno_responsavel;
