-- Script para habilitar o Realtime na tabela de chamadas da portaria
-- Executar no SQL Editor do Supabase

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'saida_calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.saida_calls;
    END IF;
END $$;
