-- Remover campos da tabela de responsáveis
ALTER TABLE responsaveis 
  DROP COLUMN IF EXISTS cpf, 
  DROP COLUMN IF EXISTS rg;

-- Remover campos da tabela de alunos
ALTER TABLE alunos 
  DROP COLUMN IF EXISTS cpf, 
  DROP COLUMN IF EXISTS naturalidade;
