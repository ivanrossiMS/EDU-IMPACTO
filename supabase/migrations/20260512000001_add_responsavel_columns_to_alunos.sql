-- Adicionar colunas de responsáveis na tabela de alunos
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS responsavel text default '',
ADD COLUMN IF NOT EXISTS responsavel_financeiro text default '',
ADD COLUMN IF NOT EXISTS responsavel_pedagogico text default '';
