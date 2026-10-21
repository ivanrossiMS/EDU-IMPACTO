-- =============================================================================
-- Migration: 20261020132500_enable_rls_grade_horaria.sql
-- Purpose:
--   Fix Supabase Security Advisor critical issue `rls_disabled_in_public`
--   on `public.grade_horaria` by enabling Row-Level Security (RLS),
--   revoking anonymous access, allowing authenticated read access,
--   and restricting write operations (INSERT/UPDATE/DELETE) to staff.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'grade_horaria'
  ) THEN
    -- 1. Enable Row-Level Security on public.grade_horaria
    ALTER TABLE public.grade_horaria ENABLE ROW LEVEL SECURITY;

    -- 2. Revoke all direct privileges from unauthenticated (anon) role
    REVOKE ALL ON public.grade_horaria FROM anon;

    -- 3. Clean up any legacy policies if present
    DROP POLICY IF EXISTS "grade_horaria_select_authenticated" ON public.grade_horaria;
    DROP POLICY IF EXISTS "grade_horaria_staff_manage" ON public.grade_horaria;
    DROP POLICY IF EXISTS "grade_horaria_staff_insert" ON public.grade_horaria;
    DROP POLICY IF EXISTS "grade_horaria_staff_update" ON public.grade_horaria;
    DROP POLICY IF EXISTS "grade_horaria_staff_delete" ON public.grade_horaria;

    -- 4. Allow authenticated users (staff, students, guardians) to read schedules
    CREATE POLICY "grade_horaria_select_authenticated"
      ON public.grade_horaria
      FOR SELECT
      TO authenticated
      USING (true);

    -- 5. Restrict INSERT / UPDATE / DELETE to active staff members only
    CREATE POLICY "grade_horaria_staff_insert"
      ON public.grade_horaria
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_staff());

    CREATE POLICY "grade_horaria_staff_update"
      ON public.grade_horaria
      FOR UPDATE
      TO authenticated
      USING (public.is_staff())
      WITH CHECK (public.is_staff());

    CREATE POLICY "grade_horaria_staff_delete"
      ON public.grade_horaria
      FOR DELETE
      TO authenticated
      USING (public.is_staff());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
