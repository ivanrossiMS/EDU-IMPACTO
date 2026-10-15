-- =============================================================================
-- Migration: 20261015000000_phase1_2_3_security_schema_unification.sql
-- Purpose:
--   1. Ensure authoritative public.is_staff() function (checks system_users)
--   2. Restrict internal/exam/HR tables from student/parent 'authenticated' role
--   3. Add missing storage path columns to matriculas_digitais & harden its RLS
--   4. Harden CredImpacto and financial_receipts RLS policies
--   5. Add compatibility columns to dre_uploads (usuario_id, arquivo_base64)
-- =============================================================================

-- ─── 1. Authoritative public.is_staff() helper ───────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text;
  v_email text;
BEGIN
  v_uid := auth.uid()::text;
  v_email := COALESCE(auth.jwt() ->> 'email', '');

  IF v_uid IS NULL AND v_email = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.system_users su
    WHERE COALESCE(LOWER(su.status), 'ativo') <> 'inativo'
      AND (
        su.id::text = v_uid
        OR (su.auth_id IS NOT NULL AND su.auth_id::text = v_uid)
        OR (v_email <> '' AND LOWER(su.email) = LOWER(v_email))
      )
  );
END;
$$;

-- ─── 2. Restrict Internal / Exam / HR Tables to Staff Only ───────────────────
DO $$
DECLARE
  tbl text;
  internal_tables text[] := ARRAY[
    'simulados_upload',
    'simulados_upload_requisicoes',
    'simulados_uploads',
    'simulados_upload_questoes',
    'simulados_upload_eventos',
    'provas_upload',
    'provas_upload_requisicoes',
    'provas_uploads',
    'provas_upload_questoes',
    'provas_upload_eventos',
    'redacao_upload',
    'redacao_upload_requisicoes',
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
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_authenticated_access', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_staff_only_access', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())',
        tbl || '_staff_only_access',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- ─── 3. Fix matriculas_digitais Missing Columns & Open RLS ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'matriculas_digitais'
  ) THEN
    ALTER TABLE public.matriculas_digitais
      ADD COLUMN IF NOT EXISTS documento_pdf_storage_path TEXT,
      ADD COLUMN IF NOT EXISTS documento_assinado_storage_path TEXT;

    ALTER TABLE public.matriculas_digitais ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.matriculas_digitais FROM anon;

    DROP POLICY IF EXISTS "Permitir leitura pública segura de contrato por token ou protocolo" ON public.matriculas_digitais;
    DROP POLICY IF EXISTS "Permitir gerenciamento total para administradores autenticados" ON public.matriculas_digitais;
    DROP POLICY IF EXISTS "matriculas_digitais_staff_access" ON public.matriculas_digitais;

    CREATE POLICY "matriculas_digitais_staff_access"
      ON public.matriculas_digitais
      FOR ALL
      TO authenticated
      USING (public.is_staff())
      WITH CHECK (public.is_staff());
  END IF;
END $$;

-- ─── 4. Harden CredImpacto & Financial Receipts RLS ──────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credimpacto_emprestimos'
  ) THEN
    DROP POLICY IF EXISTS "Gestores e colaboradores atualizam conforme fluxo" ON public.credimpacto_emprestimos;
    DROP POLICY IF EXISTS "Proibir delecao de emprestimos" ON public.credimpacto_emprestimos;
    DROP POLICY IF EXISTS "credimpacto_emprestimos_update_policy" ON public.credimpacto_emprestimos;
    CREATE POLICY "credimpacto_emprestimos_update_policy"
      ON public.credimpacto_emprestimos
      FOR UPDATE
      TO authenticated
      USING (public.is_staff() OR colaborador_id = auth.uid()::text)
      WITH CHECK (public.is_staff() OR colaborador_id = auth.uid()::text);

    DROP POLICY IF EXISTS "credimpacto_emprestimos_delete_policy" ON public.credimpacto_emprestimos;
    CREATE POLICY "credimpacto_emprestimos_delete_policy"
      ON public.credimpacto_emprestimos
      FOR DELETE
      TO authenticated
      USING (
        public.is_staff()
        OR (colaborador_id = auth.uid()::text AND status IN ('solicitado', 'recusado', 'cancelado'))
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credimpacto_parcelas'
  ) THEN
    DROP POLICY IF EXISTS "Leitura de parcelas autorizada" ON public.credimpacto_parcelas;
    DROP POLICY IF EXISTS "Insercao de parcelas autorizada" ON public.credimpacto_parcelas;
    DROP POLICY IF EXISTS "Atualizacao de parcelas autorizada" ON public.credimpacto_parcelas;
    DROP POLICY IF EXISTS "credimpacto_parcelas_staff_access" ON public.credimpacto_parcelas;
    CREATE POLICY "credimpacto_parcelas_staff_access"
      ON public.credimpacto_parcelas
      FOR ALL
      TO authenticated
      USING (public.is_staff())
      WITH CHECK (public.is_staff());
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credimpacto_audit_logs'
  ) THEN
    DROP POLICY IF EXISTS "Leitura de logs auditoria" ON public.credimpacto_audit_logs;
    DROP POLICY IF EXISTS "credimpacto_audit_logs_select_policy" ON public.credimpacto_audit_logs;
    CREATE POLICY "credimpacto_audit_logs_select_policy"
      ON public.credimpacto_audit_logs
      FOR SELECT
      TO authenticated
      USING (public.is_staff() OR autor_id = auth.uid()::text);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'financial_receipts'
  ) THEN
    ALTER TABLE public.financial_receipts ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.financial_receipts FROM anon;
    DROP POLICY IF EXISTS "financial_receipts_staff_access" ON public.financial_receipts;
    CREATE POLICY "financial_receipts_staff_access"
      ON public.financial_receipts
      FOR ALL
      TO authenticated
      USING (public.is_staff())
      WITH CHECK (public.is_staff());
  END IF;
END $$;

-- ─── 5. Add Missing Columns to dre_uploads ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dre_uploads'
  ) THEN
    ALTER TABLE public.dre_uploads
      ADD COLUMN IF NOT EXISTS usuario_id TEXT,
      ADD COLUMN IF NOT EXISTS arquivo_base64 TEXT;
  END IF;
END $$;
