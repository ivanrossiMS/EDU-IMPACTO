-- Create tables for Saída de Alunos module

-- Active calls and history
CREATE TABLE IF NOT EXISTS public.saida_calls (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configuration (voice, RFID, etc.)
CREATE TABLE IF NOT EXISTS public.saida_config (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guardians specific to Saída (if not using global ones)
CREATE TABLE IF NOT EXISTS public.saida_guardians (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RFID Mappings
CREATE TABLE IF NOT EXISTS public.saida_rfid (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student-Guardian links
CREATE TABLE IF NOT EXISTS public.saida_student_guardians (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saida_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saida_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saida_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saida_rfid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saida_student_guardians ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (full access)
CREATE POLICY "Full access for authenticated users on saida_calls" ON public.saida_calls
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access for authenticated users on saida_config" ON public.saida_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access for authenticated users on saida_guardians" ON public.saida_guardians
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access for authenticated users on saida_rfid" ON public.saida_rfid
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access for authenticated users on saida_student_guardians" ON public.saida_student_guardians
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
