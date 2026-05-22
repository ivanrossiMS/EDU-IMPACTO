-- Remove coluna sexo da tabela alunos
ALTER TABLE alunos DROP COLUMN IF EXISTS sexo;

-- Remove coluna sexo da tabela responsaveis
ALTER TABLE responsaveis DROP COLUMN IF EXISTS sexo;
