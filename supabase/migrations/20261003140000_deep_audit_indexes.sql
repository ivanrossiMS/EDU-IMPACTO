-- ============================================================================
-- MIGRATION: 20261003140000_deep_audit_indexes.sql
-- Descrição: Índices de alta performance e suporte a agregação escalável.
-- Totalmente seguro e idempotente com IF NOT EXISTS.
-- ============================================================================

-- 1. Provas Online: Permite index-only scan na agregação em lote de status e correções
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provas_online_tentativas') THEN
    CREATE INDEX IF NOT EXISTS idx_provas_online_tentativas_prova_stats
      ON public.provas_online_tentativas (prova_id, status, status_correcao);
  END IF;
END $$;

-- 2. Financeiro: Acelera ordenação e paginação dos títulos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'titulos') THEN
    CREATE INDEX IF NOT EXISTS idx_titulos_vencimento_desc
      ON public.titulos (vencimento DESC);
  END IF;
END $$;

-- 3. Cobranças: Acelera validação de idempotência e busca de preferências geradas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agenda_cobrancas_destinatarios') THEN
    CREATE INDEX IF NOT EXISTS idx_agenda_cobrancas_dest_status
      ON public.agenda_cobrancas_destinatarios (cobranca_id, status);
  END IF;
END $$;
