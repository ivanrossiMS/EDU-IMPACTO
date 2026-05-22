-- Altera o tipo da coluna aluno_id na tabela de junção para aceitar o código manual (texto)
-- Nota: Pode ser necessário remover a constraint de chave estrangeira antes, caso ela exista.
ALTER TABLE public.aluno_responsavel ALTER COLUMN aluno_id TYPE text;

-- Adiciona restrição UNIQUE na coluna matricula da tabela alunos (que é onde guardamos o código)
ALTER TABLE public.alunos ADD CONSTRAINT alunos_matricula_unique UNIQUE (matricula);

-- Garante que a coluna codigo existe na tabela responsaveis e adiciona restrição UNIQUE
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE public.responsaveis ADD CONSTRAINT responsaveis_codigo_unique UNIQUE (codigo);
