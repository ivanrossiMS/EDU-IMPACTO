-- =============================================================================
-- Migration: 20261013180000_security_rls_and_performance_hardening.sql
-- Purpose:
--   1. Enforce atomic deduplication on agenda_push_logs(item_id, type) (fixes 23505 contract)
--   2. Enable RLS and revoke anon write/read abuse on internal/HR/exam tables
--   3. Harden SECURITY DEFINER functions with explicit SET search_path = public
--   4. Add composite indexes for hot queries & remove redundant duplicate indexes
-- =============================================================================

-- ─── 1. Atomic Deduplication Index on agenda_push_logs(item_id, type) ─────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agenda_push_logs'
  ) THEN
    -- Remove historical duplicates keeping the earliest log entry
    DELETE FROM public.agenda_push_logs a
    USING public.agenda_push_logs b
    WHERE a.ctid > b.ctid
      AND a.item_id = b.item_id
      AND a.type = b.type;

    -- Create unique index required by lib/server/agendaNotifications.ts (error code 23505)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_push_logs_item_id_type_unique
      ON public.agenda_push_logs(item_id, type);

    -- Drop redundant non-unique indexes on the same columns
    DROP INDEX IF EXISTS public.idx_agenda_push_logs_item_type;
  END IF;
END $$;

-- ─── 2. Enable RLS & Restrict Anon Access on Internal / HR / Exam Tables ──────
DO $$
DECLARE
  tbl text;
  pol record;
  internal_tables text[] := ARRAY[
    'simulados_uploads',
    'simulados_upload_questoes',
    'simulados_upload_eventos',
    'provas_uploads',
    'provas_upload_questoes',
    'provas_upload_eventos',
    'gp_escalas_trabalho',
    'gp_solicitacoes',
    'gp_documentos',
    'gp_comunicados',
    'gp_comunicados_leitura',
    'gp_ponto_registros',
    'gp_banco_horas',
    'gp_atestados',
    'gp_onboarding_templates',
    'gp_onboarding_colaborador',
    'gp_avaliacoes_desempenho',
    'gp_folha_pagamento',
    'gp_holerites'
  ];
BEGIN
  FOREACH tbl IN ARRAY internal_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);

      -- Drop overly permissive public/anon policies if present
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tbl
          AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;

      -- Ensure authenticated staff/service_role access policy exists
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        tbl || '_authenticated_access',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tbl || '_authenticated_access',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Protect push subscription tokens and diagnostics from unauthenticated SELECT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agenda_push_subscriptions'
  ) THEN
    REVOKE SELECT, DELETE ON public.agenda_push_subscriptions FROM anon;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_diagnostics_logs'
  ) THEN
    REVOKE SELECT, DELETE, UPDATE ON public.push_diagnostics_logs FROM anon;
  END IF;
END $$;

-- ─── 3. Harden SECURITY DEFINER Functions with Explicit search_path ───────────
DO $$
DECLARE
  fn_record record;
BEGIN
  FOR fn_record IN
    SELECT p.oid::regprocedure AS fn_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'is_staff',
        'is_staff_or_admin',
        'user_allowed_aluno_ids',
        'rls_can_access_aluno',
        'get_my_responsavel_id',
        'get_my_aluno_id',
        'clear_expired_sessions',
        'cleanup_old_portaria_logs'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn_record.fn_sig);
  END LOOP;
END $$;

-- ─── 4. High-Impact Composite Indexes & Redundant Index Cleanup ───────────────
DO $$
BEGIN
  -- comunicados_respostas(comunicado_id, remetente_id, destinatario_id)
  IF (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'comunicados_respostas'
      AND column_name IN ('comunicado_id', 'remetente_id', 'destinatario_id')
  ) = 3 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comunicados_respostas_com_rem_dest ON public.comunicados_respostas(comunicado_id, remetente_id, destinatario_id)';
  END IF;

  -- portaria_eventos(aluno_id, data_hora DESC)
  IF (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portaria_eventos'
      AND column_name IN ('aluno_id', 'data_hora')
  ) = 2 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portaria_eventos_aluno_data ON public.portaria_eventos(aluno_id, data_hora DESC)';
  END IF;

  -- portaria_sync(status, dispositivo_id, updated_at)
  IF (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portaria_sync'
      AND column_name IN ('status', 'dispositivo_id', 'updated_at')
  ) = 3 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portaria_sync_status_disp_updated ON public.portaria_sync(status, dispositivo_id, updated_at)';
  END IF;

  -- agenda_cobrancas_destinatarios(destinatario_id, status)
  IF (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agenda_cobrancas_destinatarios'
      AND column_name IN ('destinatario_id', 'status')
  ) = 2 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agenda_cobrancas_dest_destinatario_status ON public.agenda_cobrancas_destinatarios(destinatario_id, status)';
  END IF;

  -- provas_online_tentativas(prova_id, aluno_id)
  IF (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'provas_online_tentativas'
      AND column_name IN ('prova_id', 'aluno_id')
  ) = 2 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_provas_online_tentativas_prova_aluno ON public.provas_online_tentativas(prova_id, aluno_id)';
  END IF;
END $$;

-- Drop duplicate single-column indexes that already have identical idx_ln_* counterparts
DROP INDEX IF EXISTS public.idx_lancamentos_nota_aluno;
DROP INDEX IF EXISTS public.idx_lancamentos_nota_turma;
