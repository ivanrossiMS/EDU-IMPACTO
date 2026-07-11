-- Permitir que aluno_id seja armazenado para isolar o badge "novo" por aluno (caso de irmaos)
ALTER TABLE public.agenda_notification_reads ADD COLUMN IF NOT EXISTS aluno_id TEXT;
ALTER TABLE public.agenda_ciencias ADD COLUMN IF NOT EXISTS aluno_id TEXT;

-- Atualizar o indice unico para incluir o aluno_id
DROP INDEX IF EXISTS idx_agenda_reads_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_reads_unique ON public.agenda_notification_reads(usuario_id, content_type, content_id, COALESCE(aluno_id, 'none'));

DROP INDEX IF EXISTS idx_agenda_ciencias_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_ciencias_unique ON public.agenda_ciencias(usuario_id, content_type, content_id, COALESCE(aluno_id, 'none'));
