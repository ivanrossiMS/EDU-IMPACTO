-- ============================================================================
-- MIGRATION: 20261007120000_prevent_test_domain_signups.sql
-- Descrição: Proteção contra abuso de SMTP / Null MX bounces na Locaweb.
-- Impede a inserção de usuários no Supabase Auth com domínios reservados
-- de teste e exemplo (RFC 2606 e RFC 6761).
--
-- Isso impede que scanners, bots ou testes automatizados acionem o envio
-- de e-mails de confirmação (confirm signup) para domínios sem MX (Null MX),
-- resguardando a reputação do servidor SMTP da escola na Locaweb.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_auth_email_not_test_domain()
RETURNS trigger AS $$
DECLARE
  v_email text;
  v_domain text;
BEGIN
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));
  
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  v_domain := SPLIT_PART(v_email, '@', 2);

  -- Bloqueia domínios de teste e exemplo reservados (RFC 2606 e RFC 6761)
  -- que possuem Null MX e causam bounce imediato de entrega
  IF v_domain IN (
    'example.com',
    'example.org',
    'example.net',
    'example.edu',
    'test.com',
    'teste.com',
    'teste.com.br',
    'local.test'
  )
  OR v_domain LIKE '%.example.com'
  OR v_domain LIKE '%.example.org'
  OR v_domain LIKE '%.example.net'
  OR v_domain LIKE '%.example.edu'
  OR v_domain LIKE '%.example'
  OR v_domain LIKE '%.invalid'
  OR v_domain LIKE '%.localhost'
  OR v_domain LIKE '%.test'
  THEN
    RAISE EXCEPTION 'Cadastro rejeitado: o domínio % é reservado para testes/exemplos e possui Null MX.', v_domain
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplica o trigger na tabela auth.users antes da inserção ou atualização
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS trg_prevent_test_domain_signups ON auth.users;
    
    CREATE TRIGGER trg_prevent_test_domain_signups
      BEFORE INSERT OR UPDATE OF email ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.check_auth_email_not_test_domain();
  END IF;
END $$;
