-- Altera o tipo da coluna ID para TEXT em todas as tabelas relacionadas
-- para permitir o uso do ID manual (como 'AL001') como identificador oficial.

-- 1. Remove as chaves estrangeiras temporariamente para permitir a mudança de tipo
ALTER TABLE IF EXISTS public.aluno_responsavel DROP CONSTRAINT IF EXISTS aluno_responsavel_aluno_id_fkey;
ALTER TABLE IF EXISTS public.aluno_responsavel DROP CONSTRAINT IF EXISTS aluno_responsavel_responsavel_id_fkey;

-- 2. Altera o tipo das colunas ID nas tabelas principais
ALTER TABLE public.alunos ALTER COLUMN id TYPE text;
ALTER TABLE public.responsaveis ALTER COLUMN id TYPE text;

-- 3. Altera o tipo das colunas na tabela de ligação
ALTER TABLE public.aluno_responsavel ALTER COLUMN aluno_id TYPE text;
ALTER TABLE public.aluno_responsavel ALTER COLUMN responsavel_id TYPE text;

-- Nota: As chaves estrangeiras podem ser recriadas depois se necessário, 
-- mas agora elas funcionarão comparando textos (IDs manuais).
