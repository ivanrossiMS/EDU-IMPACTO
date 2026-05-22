-- Criação da tabela de boletins
CREATE TABLE IF NOT EXISTS public.boletins (
  id TEXT PRIMARY KEY,
  turma_id TEXT,
  aluno_id TEXT,
  bimestre TEXT,
  dados JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.boletins ENABLE ROW LEVEL SECURITY;

-- Cria políticas (permite tudo para usuários autenticados por enquanto)
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.boletins
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
