-- ═══════════════════════════════════════════════════════════════════════════
-- EDU-IMPACTO — Otimização de Índices para Comunicados e Respostas
-- Previne PostgREST Timeout ("Thread killed by timeout manager") e Cloudflare 522
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Índice para ordenação e filtro por data de criação de comunicados
CREATE INDEX IF NOT EXISTS idx_comunicados_created_at
  ON public.comunicados(created_at DESC);

-- 2. Índice para ordenação por data do comunicado
CREATE INDEX IF NOT EXISTS idx_comunicados_data
  ON public.comunicados(data DESC);

-- 3. Índice para busca de respostas por comunicado_id
CREATE INDEX IF NOT EXISTS idx_comunicados_respostas_comunicado
  ON public.comunicados_respostas(comunicado_id);

-- 4. Índice para busca de leituras por content_id
CREATE INDEX IF NOT EXISTS idx_notif_reads_content_id
  ON public.agenda_notification_reads(content_id);

-- 5. Índice para busca de ciências por content_id
CREATE INDEX IF NOT EXISTS idx_ciencias_content_id
  ON public.agenda_ciencias(content_id);
