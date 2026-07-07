-- Criação da tabela arquivos_adaptadas para guardar os PDFs escaneados

CREATE TABLE public.arquivos_adaptadas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id text REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma text NOT NULL,
  ano_letivo text NOT NULL,
  titulo text NOT NULL,
  file_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id)
);

-- Configuração de RLS (Row Level Security)
ALTER TABLE public.arquivos_adaptadas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para todos usuários autenticados" 
ON public.arquivos_adaptadas FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" 
ON public.arquivos_adaptadas FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir deleção para o próprio criador" 
ON public.arquivos_adaptadas FOR DELETE 
TO authenticated 
USING (auth.uid() = criado_por);

-- Index para otimizar buscas
CREATE INDEX idx_arquivos_adaptadas_aluno_id ON public.arquivos_adaptadas(aluno_id);
CREATE INDEX idx_arquivos_adaptadas_ano_letivo ON public.arquivos_adaptadas(ano_letivo);
CREATE INDEX idx_arquivos_adaptadas_turma ON public.arquivos_adaptadas(turma);
