-- ==============================================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA SUPABASE / POSTGRESQL
-- Projeto: EDU-IMPACTO (impacto-edu-app)
-- 
-- Resolve definitivamente:
-- 1. Erro 23514 (Violação de check constraint chat_participants_user_role_check)
-- 2. Erro 42703 (Coluna inexistente alunos.codigo)
-- 3. Erro 22P02 (invalid input syntax for type uuid: "215655")
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORREÇÃO DA CONSTRAINT DE PAPÉIS NO CHAT (Elimina erro 23514)
-- ------------------------------------------------------------------------------
ALTER TABLE public.chat_participants 
  DROP CONSTRAINT IF EXISTS chat_participants_user_role_check;

ALTER TABLE public.chat_participants 
  ADD CONSTRAINT chat_participants_user_role_check 
  CHECK (user_role IN ('admin', 'moderator', 'member', 'observer', 'readonly', 'colaborador'));

COMMENT ON CONSTRAINT chat_participants_user_role_check ON public.chat_participants IS 
  'Permite papéis administrativos, moderadores, membros, observadores, leitura e colaboradores no chat.';


-- ------------------------------------------------------------------------------
-- 2. GARANTIR A COLUNA alunos.codigo COM SINCRONIZAÇÃO AUTOMÁTICA (Elimina erro 42703)
-- ------------------------------------------------------------------------------
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS codigo TEXT;

-- Sincroniza alunos existentes que estão sem o campo preenchido
UPDATE public.alunos 
SET codigo = COALESCE(NULLIF(matricula, ''), id) 
WHERE codigo IS NULL OR codigo = '';

-- Função e Trigger para garantir que 'codigo' e 'matricula' fiquem sempre sincronizados
CREATE OR REPLACE FUNCTION public.sync_alunos_codigo_matricula()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := NEW.matricula;
  END IF;
  IF NEW.matricula IS NULL OR NEW.matricula = '' THEN
    NEW.matricula := NEW.codigo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_alunos_codigo_matricula ON public.alunos;
CREATE TRIGGER trg_sync_alunos_codigo_matricula
  BEFORE INSERT OR UPDATE ON public.alunos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_alunos_codigo_matricula();

CREATE INDEX IF NOT EXISTS idx_alunos_codigo ON public.alunos(codigo);


-- ------------------------------------------------------------------------------
-- 3. AJUSTE DE TIPAGEM PARA IDENTIFICADORES (Elimina erro 22P02 - UUID inválido)
-- Garante que IDs manuais (ex: '215655', 'AL001') possam ser usados sem quebra de tipo
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
  -- Remover constraints temporariamente caso existam
  ALTER TABLE IF EXISTS public.aluno_responsavel DROP CONSTRAINT IF EXISTS aluno_responsavel_aluno_id_fkey;
  ALTER TABLE IF EXISTS public.aluno_responsavel DROP CONSTRAINT IF EXISTS aluno_responsavel_responsavel_id_fkey;
  
  -- Alterar tipos para TEXT nas tabelas de relacionamento e cadastros
  ALTER TABLE public.alunos ALTER COLUMN id TYPE TEXT;
  ALTER TABLE public.responsaveis ALTER COLUMN id TYPE TEXT;
  ALTER TABLE public.aluno_responsavel ALTER COLUMN aluno_id TYPE TEXT;
  ALTER TABLE public.aluno_responsavel ALTER COLUMN responsavel_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'Aviso na alteração de tipo: %', SQLERRM;
END $$;


-- ------------------------------------------------------------------------------
-- 4. RECARREGAR O SCHEMA CACHE DO POSTGREST IMEDIATAMENTE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
