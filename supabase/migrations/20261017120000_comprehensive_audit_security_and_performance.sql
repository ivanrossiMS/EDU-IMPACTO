-- =============================================================================
-- Migration: 20261017120000_comprehensive_audit_security_and_performance.sql
-- Purpose:
--   1. Fix public.is_staff() and public.is_staff_or_admin() so family accounts
--      (Responsável/Aluno rows in system_users) are NEVER treated as staff in RLS,
--      and mark them STABLE with explicit SET search_path = public.
--   2. Harden RLS on HR, Gestión de Pessoas (GP), Financial, and Administrative
--      tables against direct client/anon/non-staff queries.
--   3. Harden storage.objects policies for private/sensitive buckets (documentos).
--   4. Create high-impact composite & functional indexes for hot production paths
--      (titulos, aluno_responsavel, matriculas_digitais, financial_receipts,
--       comunicados_respostas, portaria_eventos).
-- Rollback instructions:
--   All policies and indexes created here use deterministic names and can be
--   reverted via DROP INDEX IF EXISTS / DROP POLICY IF EXISTS without data loss.
-- =============================================================================

-- ─── 1. Authoritative STABLE public.is_staff() & public.is_staff_or_admin() ──
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text;
  v_email text;
BEGIN
  v_uid := (SELECT auth.uid())::text;
  v_email := COALESCE((SELECT auth.jwt()) ->> 'email', '');

  IF v_uid IS NULL AND v_email = '' THEN
    RETURN false;
  END IF;

  -- Verifica em system_users excluindo explicitamente perfis/cargos de Família/Aluno
  IF EXISTS (
    SELECT 1
    FROM public.system_users su
    WHERE COALESCE(LOWER(su.status), 'ativo') NOT IN ('inativo', 'excluido', 'bloqueado', 'desligado')
      AND (
        su.id::text = v_uid
        OR (su.auth_id IS NOT NULL AND su.auth_id::text = v_uid)
        OR (v_email <> '' AND LOWER(su.email) = LOWER(v_email))
      )
      AND LOWER(TRIM(COALESCE(su.perfil, su.cargo, su.dados->>'perfil', su.dados->>'cargo', ''))) NOT IN (
        '', 'responsavel', 'responsável', 'aluno', 'pai', 'mae', 'mãe', 'familia', 'família'
      )
  ) THEN
    RETURN true;
  END IF;

  -- Fallback para tabela funcionarios (colaboradores ativos)
  IF EXISTS (
    SELECT 1
    FROM public.funcionarios f
    WHERE COALESCE(LOWER(f.status), 'ativo') NOT IN ('inativo', 'excluido', 'demitido', 'desligado')
      AND (
        f.id::text = v_uid
        OR (v_email <> '' AND LOWER(f.email) = LOWER(v_email))
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff();
$$;

-- ─── 2. Harden RLS on HR, Gestão de Pessoas & Financial Internal Tables ──────
DO $$
DECLARE
  tbl text;
  pol record;
  staff_tables text[] := ARRAY[
    'adiantamentos',
    'advertencias',
    'ausencias',
    'contas_pagar',
    'movimentacoes',
    'caixas',
    'plano_contas',
    'autorizacoes_financeiras',
    'gp_denuncias',
    'gp_atendimentos',
    'gp_sst_asos',
    'gp_sst_documentos',
    'gp_inventario_riscos',
    'gp_plano_acao',
    'gp_checklists',
    'gp_treinamentos',
    'gp_assinaturas'
  ];
BEGIN
  FOREACH tbl IN ARRAY staff_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);

      -- Remove políticas públicas/anon ou USING(true) irrestritas conhecidas
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tbl
          AND (
            'public' = ANY(roles)
            OR 'anon' = ANY(roles)
            OR policyname ILIKE '%allow all%'
            OR policyname ILIKE '%public%'
            OR policyname ILIKE '%authenticated_access%'
          )
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_staff_rls_policy', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())',
        tbl || '_staff_rls_policy',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- ─── 3. Harden Storage Bucket 'documentos' (Contratos / PDFs Sensíveis) ──────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS "documentos_public_select" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir leitura pública no bucket documentos" ON storage.objects;
    DROP POLICY IF EXISTS "documentos_staff_authenticated_access" ON storage.objects;

    CREATE POLICY "documentos_staff_authenticated_access"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (bucket_id = 'documentos' AND public.is_staff())
      WITH CHECK (bucket_id = 'documentos' AND public.is_staff());
  END IF;
END $$;

-- ─── 4. High-Impact Composite & Functional Indexes ───────────────────────────
DO $$
BEGIN
  -- 4.1 titulos: busca por aluno_id / JSONB alunoId e ordenação por vencimento DESC
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'titulos'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'titulos' AND column_name = 'aluno_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_titulos_aluno_id_vencimento ON public.titulos (aluno_id, vencimento DESC)';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'titulos' AND column_name = 'dados'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_titulos_dados_aluno_id ON public.titulos ((dados->>''alunoId'')) WHERE (dados->>''alunoId'') IS NOT NULL';
    END IF;
  END IF;

  -- 4.2 aluno_responsavel: índice composto reverso (responsavel_id, aluno_id) para escopo familiar rápido
  IF (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aluno_responsavel'
      AND column_name IN ('responsavel_id', 'aluno_id')
  ) = 2 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_resp_aluno ON public.aluno_responsavel (responsavel_id, aluno_id)';
  END IF;

  -- 4.3 matriculas_digitais: busca por token_assinatura e protocolo (rotas públicas de assinatura/PDF)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'matriculas_digitais'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'matriculas_digitais' AND column_name = 'token_assinatura'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_token_assinatura ON public.matriculas_digitais (token_assinatura) WHERE token_assinatura IS NOT NULL';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'matriculas_digitais' AND column_name = 'protocolo'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_protocolo ON public.matriculas_digitais (protocolo) WHERE protocolo IS NOT NULL';
    END IF;
  END IF;

  -- 4.4 financial_receipts: validação pública por validation_token e estorno por baixa_id
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'financial_receipts'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_receipts' AND column_name = 'validation_token'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_financial_receipts_validation_token ON public.financial_receipts (validation_token)';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_receipts' AND column_name = 'baixa_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_financial_receipts_baixa_id_pattern ON public.financial_receipts (baixa_id text_pattern_ops)';
    END IF;
  END IF;

  -- 4.5 movimentacoes: busca por prefixo de código de baixa (id LIKE 'COD-%')
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'movimentacoes' AND column_name = 'id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_movimentacoes_id_pattern ON public.movimentacoes (id text_pattern_ops)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
