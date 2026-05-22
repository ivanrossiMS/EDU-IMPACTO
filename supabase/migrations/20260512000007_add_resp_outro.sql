-- Adiciona a coluna resp_outro na tabela aluno_responsavel
ALTER TABLE aluno_responsavel ADD COLUMN IF NOT EXISTS resp_outro BOOLEAN DEFAULT false;
