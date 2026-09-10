-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Adicionar colunas de ordenação em simulados_upload e provas_upload
-- Executar no Supabase SQL Editor para habilitar ordenação personalizada
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Simulados Upload
ALTER TABLE IF EXISTS public.simulados_upload 
  ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordem_series JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_simulados_upload_ordem ON public.simulados_upload(ordem);

-- 2. Provas Upload
ALTER TABLE IF EXISTS public.provas_upload 
  ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordem_series JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_provas_upload_ordem ON public.provas_upload(ordem);
