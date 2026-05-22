-- Adiciona a coluna dias_acesso na tabela responsaveis como um array de textos
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS dias_acesso text[] DEFAULT '{}';

-- Comentário para documentação
COMMENT ON COLUMN public.responsaveis.dias_acesso IS 'Dias da semana permitidos para retirada do aluno via RFID';
