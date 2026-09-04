-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Adicionar campo eh_adaptada nas tabelas de upload
-- Executar no Supabase SQL Editor para habilitar a flag eh_adaptada nativamente
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.simulados_upload 
  ADD COLUMN IF NOT EXISTS eh_adaptada BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.provas_upload 
  ADD COLUMN IF NOT EXISTS eh_adaptada BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.redacao_upload 
  ADD COLUMN IF NOT EXISTS eh_adaptada BOOLEAN DEFAULT false;

-- Índices opcionais para listagens filtradas
CREATE INDEX IF NOT EXISTS idx_simulados_upload_eh_adaptada ON public.simulados_upload(eh_adaptada);
CREATE INDEX IF NOT EXISTS idx_provas_upload_eh_adaptada ON public.provas_upload(eh_adaptada);
CREATE INDEX IF NOT EXISTS idx_redacao_upload_eh_adaptada ON public.redacao_upload(eh_adaptada);
