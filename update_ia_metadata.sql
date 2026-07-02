ALTER TABLE public.provas_questoes ADD COLUMN IF NOT EXISTS gerado_por_ia BOOLEAN DEFAULT false;
ALTER TABLE public.provas_questoes ADD COLUMN IF NOT EXISTS ia_autor_nome TEXT;
ALTER TABLE public.provas_questoes ADD COLUMN IF NOT EXISTS ia_titulo TEXT;
ALTER TABLE public.provas_questoes ADD COLUMN IF NOT EXISTS ia_serie TEXT;

ALTER TABLE public.simulados_questoes ADD COLUMN IF NOT EXISTS gerado_por_ia BOOLEAN DEFAULT false;
ALTER TABLE public.simulados_questoes ADD COLUMN IF NOT EXISTS ia_autor_nome TEXT;
ALTER TABLE public.simulados_questoes ADD COLUMN IF NOT EXISTS ia_titulo TEXT;
ALTER TABLE public.simulados_questoes ADD COLUMN IF NOT EXISTS ia_serie TEXT;
