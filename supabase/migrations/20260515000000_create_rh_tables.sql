-- Create tables for RH modules

CREATE TABLE IF NOT EXISTS public.adiantamentos (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT,
    funcionario_nome TEXT,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advertencias (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ausencias (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilita RLS nas novas tabelas
ALTER TABLE public.adiantamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ausencias ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Seguindo o padrão do seu projeto: usuários autenticados podem fazer tudo)
-- Adiantamentos
CREATE POLICY "Permitir leitura para usuários autenticados" ON adiantamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção para usuários autenticados" ON adiantamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualização para usuários autenticados" ON adiantamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir exclusão para usuários autenticados" ON adiantamentos FOR DELETE TO authenticated USING (true);

-- Advertências
CREATE POLICY "Permitir leitura para usuários autenticados" ON advertencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção para usuários autenticados" ON advertencias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualização para usuários autenticados" ON advertencias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir exclusão para usuários autenticados" ON advertencias FOR DELETE TO authenticated USING (true);

-- Ausências
CREATE POLICY "Permitir leitura para usuários autenticados" ON ausencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção para usuários autenticados" ON ausencias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualização para usuários autenticados" ON ausencias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir exclusão para usuários autenticados" ON ausencias FOR DELETE TO authenticated USING (true);
