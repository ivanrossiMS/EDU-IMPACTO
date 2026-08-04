-- ==========================================================
-- SCRIPT DE SEGURANÇA SUPABASE: ATIVAR RLS EM TODAS AS TABELAS
-- Projeto: EDU-IMPACTO (lrpwerkkqrjkcauofhph)
-- ==========================================================

-- 1. Ativa o Row Level Security (RLS) em todas as tabelas do schema public
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- 2. Garantir políticas básicas de leitura caso o front-end consulte diretamente via anon key
-- Nota: O Next.js com SUPABASE_SERVICE_ROLE_KEY ignora RLS (funciona sempre).
-- Mas se alguma tabela for consultada diretamente do cliente via chave anon, execute políticas como o exemplo abaixo:

/*
-- Exemplo de política para permitir leitura pública se necessário:
CREATE POLICY "Permitir leitura anonima" ON public.sua_tabela FOR SELECT USING (true);
*/
