-- Criação da tabela de conteúdos lecionados
CREATE TABLE IF NOT EXISTS public.diario_conteudos (
  id TEXT PRIMARY KEY,
  turma_id TEXT NOT NULL,
  ano TEXT NOT NULL,
  data DATE NOT NULL,
  disciplina TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  observacoes TEXT,
  aulas INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.diario_conteudos ENABLE ROW LEVEL SECURITY;

-- Cria políticas (permite tudo para usuários autenticados por enquanto)
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.diario_conteudos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
