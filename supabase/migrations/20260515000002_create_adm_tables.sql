-- Create tables for Administrativo module (Manutenção and Pedidos de Livros)

-- Manutenção
CREATE TABLE IF NOT EXISTS public.adm_manutencao (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos de Livros
CREATE TABLE IF NOT EXISTS public.adm_pedidos_livros (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos de Livros Manuais
CREATE TABLE IF NOT EXISTS public.adm_pedidos_livros_manuais (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adm_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_pedidos_livros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_pedidos_livros_manuais ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (full access)
CREATE POLICY "Full access for authenticated users on adm_manutencao" ON public.adm_manutencao
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access for authenticated users on adm_pedidos_livros" ON public.adm_pedidos_livros
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Full access for authenticated users on adm_pedidos_livros_manuais" ON public.adm_pedidos_livros_manuais
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
