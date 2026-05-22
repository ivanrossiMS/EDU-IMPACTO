-- Adiciona colunas tipo e data_entrega na tabela diario_conteudos
ALTER TABLE public.diario_conteudos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'conteudo';
ALTER TABLE public.diario_conteudos ADD COLUMN IF NOT EXISTS data_entrega DATE;
